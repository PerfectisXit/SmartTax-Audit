import React from 'react';
import { AuditItem, DiningAppState } from '../components/audit/types';
import { AuditFilter } from '../components/audit/AuditFilters';
import { DiningApplicationData } from '../types';
import { getAuditConcurrency } from '../services/storageService';
import { useErrorReporter } from './useErrorReporter';
import { useLogStore } from './useLogStore';
import type { OcrProvider } from '../domain/provider';
import { getAuditCredentials } from './audit/credentials';
import { createPendingAuditItems } from './audit/helpers';
import {
  buildAuditNonDiningNotice,
  buildAuditNoticeOnly,
  buildAuditStats,
  filterAuditItems,
  paginateAuditItems
} from './audit/selectors';
import { useAuditOrchestrator } from './audit/useAuditOrchestrator';

export const useAuditController = (provider: OcrProvider, onNeedSettings?: () => void) => {
  const [auditItems, setAuditItems] = React.useState<AuditItem[]>([]);
  const [diningApp, setDiningApp] = React.useState<DiningAppState>({ status: 'idle' });
  const diningAppRef = React.useRef<DiningApplicationData | undefined>(undefined);
  const [auditFilter, setAuditFilter] = React.useState<AuditFilter>('all');
  const [auditIssuesFirst, setAuditIssuesFirst] = React.useState(true);
  const [auditPage, setAuditPage] = React.useState(1);
  const AUDIT_PAGE_SIZE = 20;
  const AUDIT_CONCURRENCY = getAuditConcurrency();

  const { error, reportError, clearError } = useErrorReporter();
  const { logs, appendLog, clearLogs } = useLogStore();
  const getCredentials = React.useCallback(() => getAuditCredentials(provider), [provider]);
  const { isLoading, processAuditItems } = useAuditOrchestrator({
    provider,
    concurrency: AUDIT_CONCURRENCY,
    getCredentials,
    onNeedSettings,
    setAuditItems,
    setDiningApp,
    diningAppRef,
    reportError,
    appendLog
  });

  const resetDiningApp = () => {
    diningAppRef.current = undefined;
    setDiningApp({ status: 'idle' });
  };

  const handleAuditFilesSelect = (files: File[]) => {
    if (files.length === 0) return;
    const newItems = createPendingAuditItems(files);
    if (newItems.length > 0) {
      setAuditItems(prev => [...prev, ...newItems]);
      void processAuditItems(newItems);
    }
  };

  const filteredAuditItems = React.useMemo(() => {
    return filterAuditItems(auditItems, auditFilter, auditIssuesFirst);
  }, [auditItems, auditFilter, auditIssuesFirst]);

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditItems.length / AUDIT_PAGE_SIZE));
  const pagedAuditItems = React.useMemo(() => {
    return paginateAuditItems(filteredAuditItems, auditPage, AUDIT_PAGE_SIZE);
  }, [filteredAuditItems, auditPage]);

  React.useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
    if (auditPage < 1) setAuditPage(1);
  }, [auditPage, auditTotalPages]);

  const auditStats = React.useMemo(() => {
    return buildAuditStats(auditItems);
  }, [auditItems]);

  const auditNonDiningNotice = React.useMemo(() => {
    return buildAuditNonDiningNotice(auditItems);
  }, [auditItems]);

  const auditNoticeOnly = React.useMemo(() => {
    return buildAuditNoticeOnly(auditItems, diningApp, auditNonDiningNotice);
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
