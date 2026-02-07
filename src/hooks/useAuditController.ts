import React from 'react';
import { AuditItem, DiningAppState } from '../components/audit/types';
import { AuditFilter } from '../components/audit/AuditFilters';
import { DiningApplicationData, ExpenseCategory } from '../types';
import { detectDiningApplication, detectInvoice } from '../services/auditWorkflow';
import { auditInvoice, validateDiningApplicationAgainstInvoice } from '../services/auditService';
import { addHistoryModel, getApiKey, getAuditConcurrency, getModel } from '../services/storageService';
import { runConcurrent } from '../services/taskQueue';
import { useErrorReporter } from './useErrorReporter';
import { useLogStore } from './useLogStore';

export const useAuditController = (provider: string, onNeedSettings?: () => void) => {
  const [auditItems, setAuditItems] = React.useState<AuditItem[]>([]);
  const [diningApp, setDiningApp] = React.useState<DiningAppState>({ status: 'idle' });
  const diningAppRef = React.useRef<DiningApplicationData | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(false);
  const [auditFilter, setAuditFilter] = React.useState<AuditFilter>('all');
  const [auditIssuesFirst, setAuditIssuesFirst] = React.useState(true);
  const [auditPage, setAuditPage] = React.useState(1);
  const AUDIT_PAGE_SIZE = 20;
  const AUDIT_CONCURRENCY = getAuditConcurrency();

  const { error, reportError, clearError } = useErrorReporter();
  const { logs, appendLog, clearLogs } = useLogStore();

  const updateAuditItem = (id: string, patch: Partial<AuditItem>) => {
    setAuditItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
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

  const processAuditItems = async (items: Array<{ id: string; file: File }>) => {
    setIsLoading(true);
    const { apiKey, modelName, err } = getCredentials();
    if (err) {
      reportError(err, '审核任务无法启动');
      if (onNeedSettings) onNeedSettings();
      setIsLoading(false);
      return;
    }

    await runConcurrent(items, AUDIT_CONCURRENCY, async (next) => {
      updateAuditItem(next.id, { status: 'processing' });
      try {
        try {
          const appData = await detectDiningApplication(next.file, provider as any, apiKey, modelName);
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
        } catch {
          // fallthrough to invoice
        }
        const extractedData = await detectInvoice(next.file, provider as any, apiKey, modelName);
        const processedResult = auditInvoice(extractedData);
        addHistoryModel(provider as any, modelName);
        appendLog({ level: 'info', message: `识别完成：${next.file.name}` });
        const issues = (diningAppRef.current && processedResult.category === ExpenseCategory.DINING)
          ? validateDiningApplicationAgainstInvoice(diningAppRef.current, processedResult.data)
          : undefined;
        updateAuditItem(next.id, { status: 'success', kind: 'invoice', result: processedResult, diningIssues: issues });
      } catch (err: any) {
        reportError(err.message || "分析过程中发生错误，请检查 Key 或网络", '识别失败');
        appendLog({ level: 'error', message: `识别失败：${next.file.name}`, context: err.message || '未知错误' });
        updateAuditItem(next.id, { status: 'error', error: err.message || "分析过程中发生错误，请检查 Key 或网络" });
      }
    });
    setIsLoading(false);
  };

  const resetDiningApp = () => {
    diningAppRef.current = undefined;
    setDiningApp({ status: 'idle' });
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

  return {
    auditItems,
    setAuditItems,
    diningApp,
    setDiningApp,
    resetDiningApp,
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
  };
};
