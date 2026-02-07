
import React, { useState } from 'react';
import pkg from '../package.json';
import { SettingsModal, OcrProvider } from './components/SettingsModal';
import { UsageModal } from './components/UsageModal';
import { TravelReimbursement } from './components/TravelReimbursement';
import { packageAndDownloadAuditFiles } from './services/fileService';
import { getModel, getProvider } from './services/storageService';
import { useAuditController } from './hooks/useAuditController';
import { AuditPage } from './components/audit/AuditPage';

const App: React.FC = () => {
  // Global Settings
  const [provider, setProvider] = useState<OcrProvider>('siliconflow');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'audit' | 'travel'>('audit');
  const [openrouterHealth, setOpenrouterHealth] = useState<{ ok: boolean; msg: string } | null>(null);

  // Audit Mode State
  const {
    auditItems,
    setAuditItems,
    diningApp,
    auditFilter,
    setAuditFilter,
    auditIssuesFirst,
    setAuditIssuesFirst,
    auditPage,
    setAuditPage,
    AUDIT_PAGE_SIZE,
    pagedAuditItems,
    auditTotalPages,
    auditStats,
    auditNonDiningNotice,
    auditNoticeOnly,
    handleAuditFilesSelect,
    getCredentials,
    isLoading,
    error,
    clearError,
    logs,
    clearLogs
  } = useAuditController(provider, () => setIsSettingsOpen(true));
  
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
