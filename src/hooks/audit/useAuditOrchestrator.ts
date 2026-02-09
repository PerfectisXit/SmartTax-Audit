import React from 'react';
import { AuditItem, DiningAppState } from '../../components/audit/types';
import type { OcrProvider } from '../../domain/provider';
import { auditInvoice } from '../../services/auditService';
import { detectDiningApplication, detectInvoice } from '../../services/auditWorkflow';
import { addHistoryModel } from '../../services/storageService';
import { runConcurrent } from '../../services/taskQueue';
import type { DiningApplicationData } from '../../types';
import { applyDiningPairValidation } from './helpers';
import type { AuditCredentials } from './credentials';

type PendingAuditTask = { id: string; file: File };

type UseAuditOrchestratorInput = {
  provider: OcrProvider;
  concurrency: number;
  getCredentials: () => AuditCredentials;
  onNeedSettings?: () => void;
  setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>>;
  setDiningApp: React.Dispatch<React.SetStateAction<DiningAppState>>;
  diningAppRef: React.MutableRefObject<DiningApplicationData | undefined>;
  reportError: (message: string, title?: string) => void;
  appendLog: (entry: { level: 'info' | 'error'; message: string; context?: string }) => void;
};

const toErrorMessage = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return '分析过程中发生错误，请检查 Key 或网络';
};

export const useAuditOrchestrator = ({
  provider,
  concurrency,
  getCredentials,
  onNeedSettings,
  setAuditItems,
  setDiningApp,
  diningAppRef,
  reportError,
  appendLog
}: UseAuditOrchestratorInput) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const updateAuditItem = React.useCallback((id: string, patch: Partial<AuditItem>) => {
    setAuditItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, [setAuditItems]);

  const processAuditItems = React.useCallback(async (items: PendingAuditTask[]) => {
    setIsLoading(true);
    const { apiKey, modelName, err } = getCredentials();
    if (err) {
      reportError(err, '审核任务无法启动');
      if (onNeedSettings) onNeedSettings();
      setIsLoading(false);
      return;
    }

    await runConcurrent(items, concurrency, async (next) => {
      updateAuditItem(next.id, { status: 'processing' });
      try {
        try {
          const appData = await detectDiningApplication(next.file, provider, apiKey, modelName);
          if (appData.isDiningApplication) {
            diningAppRef.current = appData;
            setDiningApp({ status: 'success', file: next.file, data: appData });
            appendLog({ level: 'info', message: `识别申请单：${next.file.name}` });
            setAuditItems(prev => {
              const marked = prev.map(i => i.id === next.id ? { ...i, status: 'success', kind: 'application', error: undefined } : i);
              return applyDiningPairValidation(marked, appData);
            });
            return;
          }
        } catch {
          // Fall through to invoice extraction.
        }

        const extractedData = await detectInvoice(next.file, provider, apiKey, modelName);
        const processedResult = auditInvoice(extractedData);
        addHistoryModel(provider, modelName);
        appendLog({ level: 'info', message: `识别完成：${next.file.name}` });
        setAuditItems(prev => {
          const marked = prev.map(i => i.id === next.id
            ? { ...i, status: 'success', kind: 'invoice', result: processedResult, error: undefined }
            : i);
          return applyDiningPairValidation(marked, diningAppRef.current);
        });
      } catch (err: unknown) {
        const message = toErrorMessage(err);
        reportError(message, '识别失败');
        appendLog({ level: 'error', message: `识别失败：${next.file.name}`, context: message });
        updateAuditItem(next.id, { status: 'error', error: message });
      }
    });

    setIsLoading(false);
  }, [
    appendLog,
    concurrency,
    diningAppRef,
    getCredentials,
    onNeedSettings,
    provider,
    reportError,
    setAuditItems,
    setDiningApp,
    updateAuditItem
  ]);

  return { isLoading, processAuditItems };
};
