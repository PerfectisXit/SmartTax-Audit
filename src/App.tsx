
import React, { useState } from 'react';
import pkg from '../package.json';
import { SettingsModal, OcrProvider } from './components/SettingsModal';
import { UsageModal } from './components/UsageModal';
import { TravelReimbursement } from './components/TravelReimbursement';
import { auditInvoice, validateDiningApplicationAgainstInvoice } from './services/auditService';
import { DiningApplicationData, ExpenseCategory } from './types';
import { packageAndDownloadAuditFiles } from './services/fileService';
import { addHistoryModel, getApiKey, getAuditConcurrency, getModel, getProvider } from './services/storageService';
import { AuditItem, DiningAppState } from './components/audit/types';
import { AuditFilter } from './components/audit/AuditFilters';
import { useErrorReporter } from './hooks/useErrorReporter';
import { detectDiningApplication, detectInvoice } from './services/auditWorkflow';
import { runConcurrent } from './services/taskQueue';
import { useLogStore } from './hooks/useLogStore';
import { AuditPage } from './components/audit/AuditPage';

const App: React.FC = () => {
  // Global Settings
  const [provider, setProvider] = useState<OcrProvider>('siliconflow');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'audit' | 'travel'>('audit');
  const [openrouterHealth, setOpenrouterHealth] = useState<{ ok: boolean; msg: string } | null>(null);

  // Audit Mode State
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [diningApp, setDiningApp] = useState<DiningAppState>({ status: 'idle' });
  const diningAppRef = React.useRef<DiningApplicationData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { error, reportError, clearError } = useErrorReporter();
  const { logs, appendLog, clearLogs } = useLogStore();
  const AUDIT_CONCURRENCY = getAuditConcurrency();
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 20;
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all');
  const [auditIssuesFirst, setAuditIssuesFirst] = useState(true);
  
  // Load initial provider
  React.useEffect(() => {
    const p = getProvider() as OcrProvider | null;
    if (p) setProvider(p);
  }, []);

  React.useEffect(() => {
    if (provider !== 'openrouter') {
      setOpenrouterHealth(null);
      return;
    }
    let cancelled = false;
    fetch('/api/openrouter/models')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          const err: any = new Error(text || `HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then(() => {
        if (cancelled) return;
        setOpenrouterHealth({ ok: true, msg: '' });
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = typeof e?.status === 'number' ? e.status : null;
        if (status === 404) {
          setOpenrouterHealth({ ok: false, msg: '未检测到后端 /api/openrouter，请先启动 `npm run server` 并重启前端' });
        } else {
          setOpenrouterHealth({ ok: false, msg: 'OpenRouter 接口不可用，请检查后端服务或网络' });
        }
      });
    return () => { cancelled = true; };
  }, [provider]);

  const refreshSettings = () => {
    const p = getProvider() as OcrProvider | null;
    if (p) setProvider(p);
  };

  // Helper to save model to history
  const saveModelToHistory = (providerKey: string, modelName: string) => {
    addHistoryModel(providerKey as any, modelName, 10);
  };

  // --- Audit Mode Logic ---
  const updateAuditItem = (id: string, patch: Partial<AuditItem>) => {
    setAuditItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const processAuditItems = async (items: Array<{ id: string; file: File }>) => {
    setIsLoading(true);
    clearError();

    const { apiKey, modelName, err } = getCredentials();
    if (err) {
      reportError(err, '审核任务无法启动');
      setIsLoading(false);
      setIsSettingsOpen(true);
      return;
    }

    await runConcurrent(items, AUDIT_CONCURRENCY, async (next) => {
      updateAuditItem(next.id, { status: 'processing' });
      try {
        try {
          const appData = await detectDiningApplication(next.file, provider, apiKey, modelName);
          if (appData.isDiningApplication) {
            diningAppRef.current = appData;
            setDiningApp({ status: 'success', file: next.file, data: appData });
            appendLog({ level: 'info', message: `识别申请单：${next.file.name}` });
            setAuditItems(prev => prev.map(i => {
              if (!i.result || i.result.category !== ExpenseCategory.DINING) return i;
              return { ...i, diningIssues: validateDiningApplicationAgainstInvoice(appData, i.result.data) };
            }));
            updateAuditItem(next.id, { status: 'success', kind: 'application' });
            return;
          }
        } catch (e) {
          // If detection fails, continue as invoice
        }
        const extractedData = await detectInvoice(next.file, provider, apiKey, modelName);
        const processedResult = auditInvoice(extractedData);
        saveModelToHistory(provider, modelName);
        appendLog({ level: 'info', message: `识别完成：${next.file.name}` });
        const issues = (diningAppRef.current && processedResult.category === ExpenseCategory.DINING)
          ? validateDiningApplicationAgainstInvoice(diningAppRef.current, processedResult.data)
          : undefined;
        updateAuditItem(next.id, { status: 'success', kind: 'invoice', result: processedResult, diningIssues: issues });
      } catch (err: any) {
        console.error(err);
        reportError(err.message || "分析过程中发生错误，请检查 Key 或网络", '识别失败');
        appendLog({ level: 'error', message: `识别失败：${next.file.name}`, context: err.message || '未知错误' });
        updateAuditItem(next.id, { status: 'error', error: err.message || "分析过程中发生错误，请检查 Key 或网络" });
      }
    });
    setIsLoading(false);
  };

  const getCredentials = () => {
    let apiKey = getApiKey(provider as any);
    let modelName = getModel(provider as any);

    if (provider === 'siliconflow') modelName = modelName || 'Qwen/Qwen3-VL-32B-Instruct';
    else if (provider === 'kimi') modelName = modelName || 'moonshot-v1-8k';
    else if (provider === 'minimax') modelName = modelName || 'abab6.5s-chat';
    else if (provider === 'zhipu') modelName = modelName || 'glm-4v';
    else if (provider === 'dashscope') modelName = modelName || 'qwen-vl-max';
    else if (provider === 'openrouter') modelName = modelName || 'openai/gpt-4o-mini';

    if (!apiKey && provider !== 'openrouter') return { apiKey: '', modelName: '', err: `请先在设置中配置 ${provider.toUpperCase()} API Key` };
    if (!modelName) return { apiKey: '', modelName: '', err: `请在设置中输入 ${provider.toUpperCase()} 的模型名称` };

    return { apiKey, modelName, err: null };
  };

  const processDiningApplicationFile = async (file: File, sourceItemId?: string) => {
    setDiningApp({ status: 'processing', file });
    const { apiKey, modelName, err } = getCredentials();
    if (err) {
      setDiningApp({ status: 'error', error: err });
      setIsSettingsOpen(true);
      return;
    }
    try {
      const appData = await detectDiningApplication(file, provider, apiKey, modelName);
      if (!appData.isDiningApplication) {
        setDiningApp({ status: 'error', file, error: '未识别到业务招待费申请单' });
        return;
      }
      diningAppRef.current = appData;
      setDiningApp({ status: 'success', file, data: appData });
      setAuditItems(prev => prev.map(i => {
        if (!i.result || i.result.category !== ExpenseCategory.DINING) return i;
        return { ...i, diningIssues: validateDiningApplicationAgainstInvoice(appData, i.result.data) };
      }));
      if (sourceItemId) updateAuditItem(sourceItemId, { status: 'success', kind: 'application' });
    } catch (e: any) {
      setDiningApp({ status: 'error', file, error: e.message || '申请单识别失败' });
    }
  };

  const handleAuditFilesSelect = (files: File[]) => {
    if (files.length === 0) return;
    const newItems = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      file,
      status: 'pending' as const
    }));
    if (newItems.length > 0) {
      setAuditItems(prev => [...prev, ...newItems]);
      void processAuditItems(newItems);
    }
  };

  const getProviderDisplayName = () => {
    if (provider === 'kimi') return 'Kimi (Moonshot)';
    if (provider === 'minimax') return 'MiniMax';
    if (provider === 'zhipu') return 'Zhipu AI';
    if (provider === 'siliconflow') return 'SiliconFlow';
    if (provider === 'dashscope') return 'DashScope (Aliyun)';
    if (provider === 'openrouter') return 'OpenRouter';
    return provider;
  };

  const getCurrentModelName = () => {
    return getModel(provider as any) || 'Default';
  };

  const filteredAuditItems = React.useMemo(() => {
    let list = auditItems;
    if (auditFilter === 'error') list = list.filter(i => i.status === 'error');
    if (auditFilter === 'success') list = list.filter(i => i.status === 'success');
    if (auditFilter === 'dining') list = list.filter(i => i.result?.category === ExpenseCategory.DINING);
    if (auditIssuesFirst) {
      list = [...list].sort((a, b) => {
        const aIssue = a.status === 'error' || (a.diningIssues && a.diningIssues.length > 0);
        const bIssue = b.status === 'error' || (b.diningIssues && b.diningIssues.length > 0);
        return Number(bIssue) - Number(aIssue);
      });
    }
    return list;
  }, [auditItems, auditFilter, auditIssuesFirst]);

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditItems.length / AUDIT_PAGE_SIZE));
  const pagedAuditItems = React.useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
    return filteredAuditItems.slice(start, start + AUDIT_PAGE_SIZE);
  }, [filteredAuditItems, auditPage]);

  React.useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
    if (auditPage < 1) setAuditPage(1);
  }, [auditPage, auditTotalPages]);

  const auditStats = React.useMemo(() => {
    const total = auditItems.length;
    const processing = auditItems.filter(i => i.status === 'processing' || i.status === 'pending').length;
    const success = auditItems.filter(i => i.status === 'success').length;
    const errorCount = auditItems.filter(i => i.status === 'error').length;
    const diningCount = auditItems.filter(i => i.result?.category === ExpenseCategory.DINING).length;
    const issueCount = auditItems.filter(i => i.status === 'error' || (i.diningIssues && i.diningIssues.length > 0)).length;
    return { total, processing, success, errorCount, diningCount, issueCount };
  }, [auditItems]);

  const auditNonDiningNotice = React.useMemo(() => {
    const count = auditItems.filter(i =>
      i.status === 'success' &&
      i.kind === 'invoice' &&
      i.result &&
      i.result.category !== ExpenseCategory.DINING &&
      i.result.category !== ExpenseCategory.ACCOMMODATION
    ).length;
    if (count <= 0) return '';
    return '未检测到餐饮票、住宿票或招待费申请单。如需差旅报销，请移至「差旅费批量报销」页面。';
  }, [auditItems]);

  const auditNoticeOnly = React.useMemo(() => {
    if (auditItems.length === 0) return false;
    if (auditItems.some(i => i.status === 'processing' || i.status === 'pending')) return false;
    const hasDiningOrAccommodation = auditItems.some(i =>
      i.status === 'success' &&
      i.kind === 'invoice' &&
      i.result &&
      (i.result.category === ExpenseCategory.DINING || i.result.category === ExpenseCategory.ACCOMMODATION)
    );
    const hasDiningApp = Boolean(diningApp.data);
    return !hasDiningOrAccommodation && !hasDiningApp && auditNonDiningNotice.length > 0;
  }, [auditItems, diningApp.data, auditNonDiningNotice]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-50/80 to-transparent -z-10 pointer-events-none"></div>

      <div className="flex flex-col items-center pt-10 px-4 sm:px-6">
        <div className="w-full max-w-7xl transition-all duration-500">
          
          {/* Header */}
          <div className="mb-8 relative flex flex-col items-center">
            {/* Settings Button */}
            <div className="absolute right-0 -top-2 flex items-center gap-2">
              <button
                onClick={() => setIsUsageOpen(true)}
                className="group flex items-center space-x-2 px-3 py-1.5 bg-white/70 border border-gray-200 shadow-sm rounded-full hover:bg-white hover:border-blue-200 transition text-gray-600 text-sm backdrop-blur"
              >
                <span className="group-hover:text-blue-600 transition-colors">用量</span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 13l3 3 7-7" />
                </svg>
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="group flex items-center space-x-2 px-3 py-1.5 bg-white/70 border border-gray-200 shadow-sm rounded-full hover:bg-white hover:border-blue-200 transition text-gray-600 text-sm backdrop-blur"
              >
                <span className="group-hover:text-blue-600 transition-colors">设置</span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl border border-gray-200 bg-white/70 shadow-sm backdrop-blur-md flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M17.6 8.2A6.5 6.5 0 1 0 18.5 12"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm">
                SmartTax <span className="text-blue-600 font-light">Audit</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium mb-4">
            <div className="flex items-center gap-1.5 text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="truncate">{getProviderDisplayName()}</span>
                <span className="text-gray-300 mx-1">|</span>
                <span className="text-xs font-mono text-gray-400">{getCurrentModelName()}</span>
            </div>
            {provider === 'openrouter' && openrouterHealth && !openrouterHealth.ok && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                {openrouterHealth.msg}
              </div>
            )}
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-100 bg-white/70 shadow-sm backdrop-blur-md mb-6">
            <span className="text-xs text-gray-500">Powered by</span>
            <span className="text-xs font-semibold text-blue-700">Pan Xuan</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-xs font-mono text-gray-500">v{pkg.version}</span>
          </div>

            {/* Tabs */}
            <div className="flex p-1 bg-white/60 backdrop-blur-md rounded-full border border-gray-100 shadow-sm apple-hover apple-press">
               <button 
                  onClick={() => setCurrentTab('audit')}
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${currentTab === 'audit' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'} apple-press`}
               >
                  票据审核
               </button>
               <button 
                  onClick={() => setCurrentTab('travel')}
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${currentTab === 'travel' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'} apple-press`}
               >
                  差旅费批量报销
               </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          {currentTab === 'audit' ? (
            // --- EXISTING AUDIT VIEW ---
            <AuditPage
              auditItems={auditItems}
              pagedAuditItems={pagedAuditItems}
              auditStats={auditStats}
              auditFilter={auditFilter}
              auditIssuesFirst={auditIssuesFirst}
              auditPage={auditPage}
              auditTotalPages={auditTotalPages}
              auditPageSize={AUDIT_PAGE_SIZE}
              diningApp={diningApp}
              isLoading={isLoading}
              error={error}
              logs={logs}
              notice={auditNonDiningNotice || undefined}
              noticeOnly={auditNoticeOnly}
              onFilterChange={setAuditFilter}
              onIssuesFirstChange={setAuditIssuesFirst}
              onBatchDownload={() => {
                const ready = auditItems.filter(i => i.status === 'success' && i.result).map(i => ({ file: i.file, result: i.result! }));
                if (ready.length > 0) packageAndDownloadAuditFiles(ready);
              }}
              onClearList={() => setAuditItems([])}
              onFileSelect={handleAuditFilesSelect}
              onPrevPage={() => setAuditPage(p => Math.max(1, p - 1))}
              onNextPage={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
              onClearError={clearError}
              onClearLogs={clearLogs}
              onGoTravel={() => setCurrentTab('travel')}
            />
          ) : (
            // --- NEW TRAVEL BATCH VIEW ---
            <div className="w-full">
               {(() => {
                  const { apiKey, modelName } = getCredentials();
                  if (!apiKey || !modelName) {
                    return (
                       <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                          <p className="text-gray-500 mb-4">请先点击右上角设置配置 API Key</p>
                          <button onClick={() => setIsSettingsOpen(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg apple-press">打开设置</button>
                       </div>
                    );
                  }
                  return (
                     <TravelReimbursement provider={provider} apiKey={apiKey} modelName={modelName} />
                  );
               })()}
            </div>
          )}

          {/* Footer */}
          <div className="mt-16 text-center">
            <p className="text-gray-400 text-xs">
              SmartTax Audit © 2024 · Internal Tool
            </p>
          </div>
        </div>

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          onSettingsChange={refreshSettings}
        />
        <UsageModal
          isOpen={isUsageOpen}
          onClose={() => setIsUsageOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;
