import { AuditItem } from '../../components/audit/types';
import { DiningApplicationData, ExpenseCategory } from '../../types';
import { validateDiningApplicationAgainstInvoice } from '../../services/auditService';

export const createPendingAuditItems = (files: File[]): AuditItem[] => {
  return files.map((file) => ({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    file,
    status: 'pending' as const
  }));
};

export const applyDiningPairValidation = (items: AuditItem[], appData?: DiningApplicationData): AuditItem[] => {
  const diningInvoiceCount = items.filter(i =>
    i.status === 'success' &&
    i.kind === 'invoice' &&
    i.result &&
    i.result.category === ExpenseCategory.DINING
  ).length;
  const diningApplicationCount = items.filter(i => i.status === 'success' && i.kind === 'application').length;
  const shouldValidatePairs = Boolean(appData) && diningInvoiceCount === 1 && diningApplicationCount === 1;

  return items.map(i => {
    if (!i.result || i.kind !== 'invoice' || i.result.category !== ExpenseCategory.DINING) {
      return i;
    }
    if (!shouldValidatePairs || !appData) {
      return { ...i, diningIssues: undefined };
    }
    return { ...i, diningIssues: validateDiningApplicationAgainstInvoice(appData, i.result.data) };
  });
};
