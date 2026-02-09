import { describe, expect, it } from 'vitest';
import { AuditItem, DiningAppState } from '../../components/audit/types';
import { ExpenseCategory, InvoiceType, TravelExpenseType } from '../../types';
import {
  buildAuditNonDiningNotice,
  buildAuditNoticeOnly,
  buildAuditStats,
  filterAuditItems,
  paginateAuditItems
} from './selectors';

const makeAuditItem = (partial: Partial<AuditItem> = {}): AuditItem => {
  const base: AuditItem = {
    id: 'id',
    file: { name: 'f.png' } as File,
    status: 'success',
    kind: 'invoice',
    result: {
      category: ExpenseCategory.OTHER,
      audit: {
        companyMatch: { passed: true, message: 'ok', severity: 'success' },
        invoiceTypeCheck: { passed: true, message: 'ok', severity: 'success' },
        generalStatus: 'valid'
      },
      data: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.OTHER,
        buyerName: 'n',
        buyerTaxId: 't',
        totalAmount: 100,
        taxRate: '6%',
        taxAmount: 6,
        invoiceDate: '2026-01-01',
        items: []
      }
    }
  };
  return { ...base, ...partial };
};

describe('selectors', () => {
  it('filters by error/success/dining', () => {
    const items: AuditItem[] = [
      makeAuditItem({ id: '1', status: 'error', kind: undefined, result: undefined }),
      makeAuditItem({ id: '2', status: 'success', result: { ...makeAuditItem().result!, category: ExpenseCategory.DINING } }),
      makeAuditItem({ id: '3', status: 'success', result: { ...makeAuditItem().result!, category: ExpenseCategory.OTHER } })
    ];

    expect(filterAuditItems(items, 'error', false).map(i => i.id)).toEqual(['1']);
    expect(filterAuditItems(items, 'success', false).map(i => i.id)).toEqual(['2', '3']);
    expect(filterAuditItems(items, 'dining', false).map(i => i.id)).toEqual(['2']);
  });

  it('sorts issues first when enabled', () => {
    const items: AuditItem[] = [
      makeAuditItem({ id: 'ok', status: 'success' }),
      makeAuditItem({ id: 'issue', status: 'success', diningIssues: ['x'] }),
      makeAuditItem({ id: 'err', status: 'error', result: undefined })
    ];

    const sorted = filterAuditItems(items, 'all', true).map(i => i.id);
    expect(sorted.indexOf('ok')).toBeGreaterThan(sorted.indexOf('issue'));
    expect(sorted.indexOf('ok')).toBeGreaterThan(sorted.indexOf('err'));
  });

  it('paginates items', () => {
    const items = ['1', '2', '3', '4', '5'].map((id) => makeAuditItem({ id }));
    expect(paginateAuditItems(items, 1, 2).map(i => i.id)).toEqual(['1', '2']);
    expect(paginateAuditItems(items, 3, 2).map(i => i.id)).toEqual(['5']);
  });

  it('builds audit stats', () => {
    const items: AuditItem[] = [
      makeAuditItem({ status: 'pending' }),
      makeAuditItem({ status: 'processing' }),
      makeAuditItem({ status: 'error', result: undefined }),
      makeAuditItem({ status: 'success', result: { ...makeAuditItem().result!, category: ExpenseCategory.DINING }, diningIssues: ['x'] }),
      makeAuditItem({ status: 'success', result: { ...makeAuditItem().result!, category: ExpenseCategory.OTHER } })
    ];

    expect(buildAuditStats(items)).toEqual({
      total: 5,
      processing: 2,
      success: 2,
      errorCount: 1,
      diningCount: 1,
      issueCount: 2
    });
  });

  it('builds notice and noticeOnly flag', () => {
    const nonDiningItems: AuditItem[] = [
      makeAuditItem({ status: 'success', kind: 'invoice', result: { ...makeAuditItem().result!, category: ExpenseCategory.OTHER } })
    ];
    const notice = buildAuditNonDiningNotice(nonDiningItems);
    expect(notice.length).toBeGreaterThan(0);

    const idleDiningApp: DiningAppState = { status: 'idle' };
    expect(buildAuditNoticeOnly(nonDiningItems, idleDiningApp, notice)).toBe(true);
    expect(buildAuditNoticeOnly(nonDiningItems, { status: 'success', data: { applicationDate: '', estimatedAmount: 0, totalPeople: 0, staffCount: 0, guestCount: 0 } }, notice)).toBe(false);
  });
});
