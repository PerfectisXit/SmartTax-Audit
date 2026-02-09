import { describe, expect, it, vi } from 'vitest';
import { InvoiceType, TravelExpenseType } from '../../types';
import {
  parseClassifierOutput,
  parseDiningApplicationOutput,
  parseInvoiceOutput
} from './parsers';

describe('vision parsers', () => {
  it('parses invoice json output into normalized invoice data', () => {
    const text = `\`\`\`json
{
  "invoiceType": "普通发票",
  "expenseType": "住宿费",
  "buyerName": "南京中交万正置业有限公司",
  "buyerTaxId": "913201143027142012",
  "totalAmount": "1,200.50",
  "taxRate": "6%",
  "taxAmount": "68.00",
  "invoiceDate": "2026-02-01",
  "items": ["住宿费"]
}
\`\`\``;

    const parsed = parseInvoiceOutput(text);
    expect(parsed.invoiceType).toBe(InvoiceType.GENERAL);
    expect(parsed.expenseType).toBe(TravelExpenseType.ACCOMMODATION);
    expect(parsed.totalAmount).toBe(1200.5);
    expect(parsed.taxAmount).toBe(68);
    expect(parsed.invoiceDate).toBe('2026-02-01');
  });

  it('falls back to regex parser when json parsing fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const text = '普通发票 开票日期 2026-01-15 价税合计 345.67';
    const parsed = parseInvoiceOutput(text);
    expect(parsed.invoiceType).toBe(InvoiceType.GENERAL);
    expect(parsed.invoiceDate).toBe('2026-01-15');
    expect(parsed.totalAmount).toBe(345.67);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('parses classifier output with tolerant schema normalization', () => {
    const text = JSON.stringify({
      fileType: 'unknown',
      isReimbursable: 'true',
      suggestedName: 'Invoice_测试',
      sortCategory: '3',
      summary: 'ok',
      extractedData: {
        expenseType: '机票',
        invoiceType: '普票',
        totalAmount: '88'
      }
    });
    const parsed = parseClassifierOutput(text);
    expect(parsed.fileType).toBe('other');
    expect(parsed.isReimbursable).toBe(true);
    expect(parsed.sortCategory).toBe(3);
    expect(parsed.suggestedName).toContain('发票');
  });

  it('parses dining application output with numeric coercion', () => {
    const text = JSON.stringify({
      isDiningApplication: 'true',
      applicationDate: '2026-02-02',
      estimatedAmount: '450',
      totalPeople: '3',
      staffCount: '1',
      guestCount: '2'
    });
    const parsed = parseDiningApplicationOutput(text);
    expect(parsed.isDiningApplication).toBe(true);
    expect(parsed.estimatedAmount).toBe(450);
    expect(parsed.totalPeople).toBe(3);
    expect(parsed.staffCount).toBe(1);
    expect(parsed.guestCount).toBe(2);
  });
});
