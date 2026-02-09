import { AuditFilter } from '../../components/audit/AuditFilters';
import { AuditItem, AuditStats, DiningAppState } from '../../components/audit/types';
import { ExpenseCategory } from '../../types';

export const filterAuditItems = (items: AuditItem[], filter: AuditFilter, issuesFirst: boolean): AuditItem[] => {
  let list = items;
  if (filter === 'error') list = list.filter(i => i.status === 'error');
  if (filter === 'success') list = list.filter(i => i.status === 'success');
  if (filter === 'dining') list = list.filter(i => i.result?.category === ExpenseCategory.DINING);
  if (issuesFirst) {
    list = [...list].sort((a, b) => {
      const aIssue = a.status === 'error' || Boolean(a.diningIssues && a.diningIssues.length > 0);
      const bIssue = b.status === 'error' || Boolean(b.diningIssues && b.diningIssues.length > 0);
      return Number(bIssue) - Number(aIssue);
    });
  }
  return list;
};

export const paginateAuditItems = (items: AuditItem[], page: number, pageSize: number): AuditItem[] => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

export const buildAuditStats = (items: AuditItem[]): AuditStats => {
  const total = items.length;
  const processing = items.filter(i => i.status === 'processing' || i.status === 'pending').length;
  const success = items.filter(i => i.status === 'success').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const diningCount = items.filter(i => i.result?.category === ExpenseCategory.DINING).length;
  const issueCount = items.filter(i => i.status === 'error' || (i.diningIssues && i.diningIssues.length > 0)).length;
  return { total, processing, success, errorCount, diningCount, issueCount };
};

export const buildAuditNonDiningNotice = (items: AuditItem[]): string => {
  const count = items.filter(i =>
    i.status === 'success' &&
    i.kind === 'invoice' &&
    i.result &&
    i.result.category !== ExpenseCategory.DINING &&
    i.result.category !== ExpenseCategory.ACCOMMODATION
  ).length;
  if (count <= 0) return '';
  return '未检测到餐饮票、住宿票或招待费申请单。如需差旅报销，请移至「差旅费批量报销」页面。';
};

export const buildAuditNoticeOnly = (items: AuditItem[], diningApp: DiningAppState, nonDiningNotice: string): boolean => {
  if (items.length === 0) return false;
  if (items.some(i => i.status === 'processing' || i.status === 'pending')) return false;
  const hasDiningOrAccommodation = items.some(i =>
    i.status === 'success' &&
    i.kind === 'invoice' &&
    i.result &&
    (i.result.category === ExpenseCategory.DINING || i.result.category === ExpenseCategory.ACCOMMODATION)
  );
  const hasDiningApp = Boolean(diningApp.data);
  return !hasDiningOrAccommodation && !hasDiningApp && nonDiningNotice.length > 0;
};
