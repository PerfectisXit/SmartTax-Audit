// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditItem, DiningAppState } from '../../components/audit/types';
import { ExpenseCategory, InvoiceType, TravelExpenseType } from '../../types';
import { useAuditOrchestrator } from './useAuditOrchestrator';

const runConcurrentMock = vi.fn(async (items: Array<{ id: string; file: File }>, _concurrency: number, worker: (item: { id: string; file: File }) => Promise<void>) => {
  for (const item of items) {
    await worker(item);
  }
});

const detectDiningApplicationMock = vi.fn();
const detectInvoiceMock = vi.fn();
const auditInvoiceMock = vi.fn();
const addHistoryModelMock = vi.fn();
const applyDiningPairValidationMock = vi.fn((items: AuditItem[]) => items);

vi.mock('../../services/taskQueue', () => ({
  runConcurrent: (...args: unknown[]) => runConcurrentMock(...(args as Parameters<typeof runConcurrentMock>))
}));

vi.mock('../../services/auditWorkflow', () => ({
  detectDiningApplication: (...args: unknown[]) => detectDiningApplicationMock(...args),
  detectInvoice: (...args: unknown[]) => detectInvoiceMock(...args)
}));

vi.mock('../../services/auditService', () => ({
  auditInvoice: (...args: unknown[]) => auditInvoiceMock(...args)
}));

vi.mock('../../services/storageService', () => ({
  addHistoryModel: (...args: unknown[]) => addHistoryModelMock(...args)
}));

vi.mock('./helpers', async () => {
  const actual = await vi.importActual('./helpers');
  return {
    ...actual,
    applyDiningPairValidation: (...args: unknown[]) => applyDiningPairValidationMock(...(args as Parameters<typeof applyDiningPairValidationMock>))
  };
});

const makeExtracted = () => ({
  invoiceType: InvoiceType.GENERAL,
  expenseType: TravelExpenseType.OTHER,
  buyerName: 'buyer',
  buyerTaxId: 'tax-id',
  totalAmount: 120,
  taxRate: '6%',
  taxAmount: 7.2,
  invoiceDate: '2026-02-09',
  items: []
});

const makeProcessed = () => ({
  category: ExpenseCategory.OTHER,
  audit: {
    companyMatch: { passed: true, message: 'ok', severity: 'success' as const },
    invoiceTypeCheck: { passed: true, message: 'ok', severity: 'success' as const },
    generalStatus: 'valid' as const
  },
  data: makeExtracted()
});

describe('useAuditOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectDiningApplicationMock.mockResolvedValue({ isDiningApplication: false });
    detectInvoiceMock.mockResolvedValue(makeExtracted());
    auditInvoiceMock.mockReturnValue(makeProcessed());
  });

  it('reports error and requests settings when credentials are missing', async () => {
    const reportError = vi.fn();
    const onNeedSettings = vi.fn();
    const appendLog = vi.fn();
    const setDiningApp = vi.fn();
    let auditItems: AuditItem[] = [{ id: 'a1', file: { name: 'a1.png' } as File, status: 'pending' }];
    const setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>> = (updater) => {
      auditItems = typeof updater === 'function' ? updater(auditItems) : updater;
    };

    const { result } = renderHook(() =>
      useAuditOrchestrator({
        provider: 'siliconflow',
        concurrency: 2,
        getCredentials: () => ({ apiKey: '', modelName: '', err: 'missing key' }),
        onNeedSettings,
        setAuditItems,
        setDiningApp,
        diningAppRef: { current: undefined },
        reportError,
        appendLog
      })
    );

    await act(async () => {
      await result.current.processAuditItems([{ id: 'a1', file: { name: 'a1.png' } as File }]);
    });

    expect(reportError).toHaveBeenCalledWith('missing key', '审核任务无法启动');
    expect(onNeedSettings).toHaveBeenCalledTimes(1);
    expect(runConcurrentMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(auditItems[0].status).toBe('pending');
  });

  it('processes invoice successfully and updates item state', async () => {
    const reportError = vi.fn();
    const appendLog = vi.fn();
    const setDiningApp = vi.fn();
    let auditItems: AuditItem[] = [{ id: 'a2', file: { name: 'a2.png' } as File, status: 'pending' }];
    const setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>> = (updater) => {
      auditItems = typeof updater === 'function' ? updater(auditItems) : updater;
    };

    const { result } = renderHook(() =>
      useAuditOrchestrator({
        provider: 'siliconflow',
        concurrency: 2,
        getCredentials: () => ({ apiKey: 'k', modelName: 'm', err: null }),
        setAuditItems,
        setDiningApp,
        diningAppRef: { current: undefined },
        reportError,
        appendLog
      })
    );

    await act(async () => {
      await result.current.processAuditItems([{ id: 'a2', file: { name: 'a2.png' } as File }]);
    });

    expect(runConcurrentMock).toHaveBeenCalledTimes(1);
    expect(detectDiningApplicationMock).toHaveBeenCalledTimes(1);
    expect(detectInvoiceMock).toHaveBeenCalledTimes(1);
    expect(auditInvoiceMock).toHaveBeenCalledTimes(1);
    expect(addHistoryModelMock).toHaveBeenCalledWith('siliconflow', 'm');
    expect(setDiningApp).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
    expect(appendLog).toHaveBeenCalledWith({ level: 'info', message: '识别完成：a2.png' });
    expect(auditItems[0].status).toBe('success');
    expect(auditItems[0].kind).toBe('invoice');
    expect(auditItems[0].result).toEqual(makeProcessed());
    expect(result.current.isLoading).toBe(false);
  });

  it('handles dining application branch and skips invoice extraction', async () => {
    const appData = {
      isDiningApplication: true,
      applicationDate: '2026-02-10',
      estimatedAmount: 300,
      totalPeople: 2,
      staffCount: 1,
      guestCount: 1
    };
    detectDiningApplicationMock.mockResolvedValueOnce(appData);

    const reportError = vi.fn();
    const appendLog = vi.fn();
    const setDiningApp = vi.fn();
    const diningAppRef: { current: any } = { current: undefined };
    let auditItems: AuditItem[] = [{ id: 'a4', file: { name: 'a4.png' } as File, status: 'pending' }];
    const setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>> = (updater) => {
      auditItems = typeof updater === 'function' ? updater(auditItems) : updater;
    };

    const { result } = renderHook(() =>
      useAuditOrchestrator({
        provider: 'siliconflow',
        concurrency: 1,
        getCredentials: () => ({ apiKey: 'k', modelName: 'm', err: null }),
        setAuditItems,
        setDiningApp,
        diningAppRef,
        reportError,
        appendLog
      })
    );

    await act(async () => {
      await result.current.processAuditItems([{ id: 'a4', file: { name: 'a4.png' } as File }]);
    });

    expect(detectDiningApplicationMock).toHaveBeenCalledTimes(1);
    expect(detectInvoiceMock).not.toHaveBeenCalled();
    expect(setDiningApp).toHaveBeenCalledWith({ status: 'success', file: { name: 'a4.png' }, data: appData });
    expect(diningAppRef.current).toEqual(appData);
    expect(appendLog).toHaveBeenCalledWith({ level: 'info', message: '识别申请单：a4.png' });
    expect(applyDiningPairValidationMock).toHaveBeenCalled();
    expect(auditItems[0].status).toBe('success');
    expect(auditItems[0].kind).toBe('application');
    expect(auditItems[0].error).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('falls back to invoice path when dining-application detection throws', async () => {
    detectDiningApplicationMock.mockRejectedValueOnce(new Error('application parse failed'));
    detectInvoiceMock.mockResolvedValueOnce(makeExtracted());
    auditInvoiceMock.mockReturnValueOnce(makeProcessed());

    const reportError = vi.fn();
    const appendLog = vi.fn();
    const setDiningApp = vi.fn();
    let auditItems: AuditItem[] = [{ id: 'a5', file: { name: 'a5.png' } as File, status: 'pending' }];
    const setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>> = (updater) => {
      auditItems = typeof updater === 'function' ? updater(auditItems) : updater;
    };

    const { result } = renderHook(() =>
      useAuditOrchestrator({
        provider: 'siliconflow',
        concurrency: 1,
        getCredentials: () => ({ apiKey: 'k', modelName: 'm', err: null }),
        setAuditItems,
        setDiningApp,
        diningAppRef: { current: undefined },
        reportError,
        appendLog
      })
    );

    await act(async () => {
      await result.current.processAuditItems([{ id: 'a5', file: { name: 'a5.png' } as File }]);
    });

    expect(detectDiningApplicationMock).toHaveBeenCalledTimes(1);
    expect(detectInvoiceMock).toHaveBeenCalledTimes(1);
    expect(auditItems[0].status).toBe('success');
    expect(auditItems[0].kind).toBe('invoice');
    expect(reportError).not.toHaveBeenCalled();
    expect(appendLog).toHaveBeenCalledWith({ level: 'info', message: '识别完成：a5.png' });
    expect(setDiningApp).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('marks item as error and reports failure when extraction fails', async () => {
    detectDiningApplicationMock.mockRejectedValueOnce(new Error('skip application'));
    detectInvoiceMock.mockRejectedValueOnce(new Error('network down'));

    const reportError = vi.fn();
    const appendLog = vi.fn();
    const setDiningApp = vi.fn();
    let auditItems: AuditItem[] = [{ id: 'a3', file: { name: 'a3.png' } as File, status: 'pending' }];
    const setAuditItems: React.Dispatch<React.SetStateAction<AuditItem[]>> = (updater) => {
      auditItems = typeof updater === 'function' ? updater(auditItems) : updater;
    };

    const { result } = renderHook(() =>
      useAuditOrchestrator({
        provider: 'siliconflow',
        concurrency: 1,
        getCredentials: () => ({ apiKey: 'k', modelName: 'm', err: null }),
        setAuditItems,
        setDiningApp,
        diningAppRef: { current: undefined },
        reportError,
        appendLog
      })
    );

    await act(async () => {
      await result.current.processAuditItems([{ id: 'a3', file: { name: 'a3.png' } as File }]);
    });

    expect(reportError).toHaveBeenCalledWith('network down', '识别失败');
    expect(appendLog).toHaveBeenCalledWith({
      level: 'error',
      message: '识别失败：a3.png',
      context: 'network down'
    });
    expect(auditItems[0].status).toBe('error');
    expect(auditItems[0].error).toBe('network down');
    expect(result.current.isLoading).toBe(false);
  });
});
