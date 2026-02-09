import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditItem } from '../../components/audit/types';
import { ExpenseCategory, InvoiceType, TravelExpenseType } from '../../types';
import { applyDiningPairValidation, createPendingAuditItems } from './helpers';
import { validateDiningApplicationAgainstInvoice } from '../../services/auditService';

vi.mock('../../services/auditService', () => ({
  validateDiningApplicationAgainstInvoice: vi.fn(() => ['mock-issue'])
}));

const makeAuditItem = (partial: Partial<AuditItem> = {}): AuditItem => {
  const base: AuditItem = {
    id: 'id',
    file: { name: 'f.png' } as File,
    status: 'success',
    kind: 'invoice',
    result: {
      category: ExpenseCategory.DINING,
      audit: {
        companyMatch: { passed: true, message: 'ok', severity: 'success' },
        invoiceTypeCheck: { passed: true, message: 'ok', severity: 'success' },
        generalStatus: 'valid'
      },
      data: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.DINING,
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

describe('helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates pending items for selected files', () => {
    const files = [{ name: 'a.png' }, { name: 'b.png' }] as File[];
    const items = createPendingAuditItems(files);
    expect(items).toHaveLength(2);
    expect(items[0].status).toBe('pending');
    expect(items[0].file.name).toBe('a.png');
    expect(items[0].id.length).toBeGreaterThan(0);
  });

  it('validates dining pair when exactly one dining invoice + one application', () => {
    const items: AuditItem[] = [
      makeAuditItem({ id: 'invoice-1' }),
      makeAuditItem({ id: 'app-1', kind: 'application', result: undefined })
    ];

    const appData = {
      applicationDate: '2026-01-01',
      estimatedAmount: 300,
      totalPeople: 2,
      staffCount: 1,
      guestCount: 1
    };

    const next = applyDiningPairValidation(items, appData);
    expect(validateDiningApplicationAgainstInvoice).toHaveBeenCalledTimes(1);
    expect(next.find(i => i.id === 'invoice-1')?.diningIssues).toEqual(['mock-issue']);
  });

  it('clears dining issues when pairing condition is not satisfied', () => {
    const items: AuditItem[] = [
      makeAuditItem({ id: 'invoice-1', diningIssues: ['old'] }),
      makeAuditItem({ id: 'invoice-2', diningIssues: ['old'] })
    ];

    const next = applyDiningPairValidation(items, {
      applicationDate: '2026-01-01',
      estimatedAmount: 300,
      totalPeople: 2,
      staffCount: 1,
      guestCount: 1
    });

    expect(validateDiningApplicationAgainstInvoice).not.toHaveBeenCalled();
    expect(next.every(i => i.diningIssues === undefined)).toBe(true);
  });
});
