import { describe, expect, it } from 'vitest';
import { analyzeTravelDuplicates } from './travelDedupService';
import { calculateTravelReport } from './travelService';
import { InvoiceType, TravelBatchItem, TravelExpenseType } from '../types';

const makeFile = (name: string, content: string) => new File([content], name, { type: 'text/plain' });

const makeItem = (overrides: Partial<TravelBatchItem> = {}): TravelBatchItem => ({
  id: overrides.id || Math.random().toString(36).slice(2),
  file: overrides.file || makeFile('ticket.txt', 'content'),
  status: overrides.status || 'success',
  result: overrides.result || {
    invoiceType: InvoiceType.GENERAL,
    expenseType: TravelExpenseType.FLIGHT,
    buyerName: '',
    buyerTaxId: '',
    totalAmount: 100,
    taxRate: '',
    taxAmount: 0,
    invoiceDate: '2026-03-20',
    items: [],
    documentType: 'screenshot',
    travelMeta: {
      travelDate: '2026-03-20',
      travelTime: '08:30',
      origin: '北京',
      destination: '上海',
      tripNumber: 'MU1234',
      platform: '',
      orderRef: '',
      hotelName: '',
    },
  },
  ...overrides,
});

describe('travelDedupService', () => {
  it('marks identical uploaded files as duplicate candidates', async () => {
    const primary = makeItem({ id: 'a1', file: makeFile('same-1.txt', 'duplicate payload') });
    const duplicate = makeItem({ id: 'a2', file: makeFile('same-2.txt', 'duplicate payload') });

    const analyzed = await analyzeTravelDuplicates([primary, duplicate]);

    expect(analyzed.summary.duplicateGroupCount).toBe(1);
    expect(analyzed.summary.estimatedSavings).toBe(100);

    const a1 = analyzed.items.find((item) => item.id === 'a1');
    const a2 = analyzed.items.find((item) => item.id === 'a2');
    expect(a1?.duplicateStatus).toBe('none');
    expect(a2?.duplicateStatus).toBe('pending_review');
    expect(a2?.duplicateReason).toContain('文件内容完全相同');
  });

  it('keeps the amount-bearing flight proof as primary over a boarding pass', async () => {
    const itinerary = makeItem({
      id: 'flight-itinerary',
      file: makeFile('flight-screenshot.txt', 'flight screenshot'),
      result: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.FLIGHT,
        buyerName: '',
        buyerTaxId: '',
        totalAmount: 880,
        taxRate: '',
        taxAmount: 0,
        invoiceDate: '2026-04-02',
        items: [],
        documentType: 'screenshot',
        travelMeta: {
          travelDate: '2026-04-02',
          travelTime: '09:20',
          origin: '北京',
          destination: '深圳',
          tripNumber: 'ZH101',
          platform: '携程',
          orderRef: 'ORDER-1',
          hotelName: '',
        },
      },
    });
    const boardingPass = makeItem({
      id: 'boarding-pass',
      file: makeFile('boarding-pass.txt', 'boarding pass'),
      result: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.FLIGHT,
        buyerName: '',
        buyerTaxId: '',
        totalAmount: 0,
        taxRate: '',
        taxAmount: 0,
        invoiceDate: '2026-04-02',
        items: [],
        documentType: 'boarding_pass',
        travelMeta: {
          travelDate: '2026-04-02',
          travelTime: '09:35',
          origin: '北京',
          destination: '深圳',
          tripNumber: 'ZH101',
          platform: '',
          orderRef: 'ORDER-1',
          hotelName: '',
        },
      },
    });

    const analyzed = await analyzeTravelDuplicates([itinerary, boardingPass]);

    const primary = analyzed.items.find((item) => item.id === 'flight-itinerary');
    const duplicate = analyzed.items.find((item) => item.id === 'boarding-pass');
    expect(primary?.duplicateStatus).toBe('none');
    expect(duplicate?.duplicateStatus).toBe('pending_review');
    expect(duplicate?.duplicatePrimaryId).toBe('flight-itinerary');
    expect(analyzed.summary.estimatedSavings).toBe(0);
  });

  it('does not merge taxi rides that have the same date and amount but different times', async () => {
    const rideOne = makeItem({
      id: 'ride-1',
      file: makeFile('ride-1.txt', 'ride one'),
      result: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.TAXI,
        buyerName: '',
        buyerTaxId: '',
        totalAmount: 36,
        taxRate: '',
        taxAmount: 0,
        invoiceDate: '2026-05-03',
        items: [],
        documentType: 'taxi_receipt',
        travelMeta: {
          travelDate: '2026-05-03',
          travelTime: '09:20',
          origin: '虹桥站',
          destination: '酒店',
          tripNumber: '',
          platform: '滴滴',
          orderRef: 'RIDE-A',
          hotelName: '',
        },
      },
    });
    const rideTwo = makeItem({
      id: 'ride-2',
      file: makeFile('ride-2.txt', 'ride two'),
      result: {
        invoiceType: InvoiceType.GENERAL,
        expenseType: TravelExpenseType.TAXI,
        buyerName: '',
        buyerTaxId: '',
        totalAmount: 36,
        taxRate: '',
        taxAmount: 0,
        invoiceDate: '2026-05-03',
        items: [],
        documentType: 'screenshot',
        travelMeta: {
          travelDate: '2026-05-03',
          travelTime: '10:05',
          origin: '酒店',
          destination: '会场',
          tripNumber: '',
          platform: '滴滴',
          orderRef: 'RIDE-B',
          hotelName: '',
        },
      },
    });

    const analyzed = await analyzeTravelDuplicates([rideOne, rideTwo]);

    expect(analyzed.summary.duplicateGroupCount).toBe(0);
    expect(analyzed.items.every((item) => item.duplicateStatus === 'none')).toBe(true);
  });

  it('preserves manual duplicate decisions and excludes confirmed duplicates from totals', async () => {
    const primary = makeItem({ id: 'p1' });
    const duplicate = makeItem({
      id: 'p2',
      duplicateStatus: 'confirmed_duplicate',
      file: makeFile('duplicate-second.txt', 'duplicate payload'),
    });

    const analyzed = await analyzeTravelDuplicates([
      { ...primary, file: makeFile('duplicate-first.txt', 'duplicate payload') },
      duplicate,
    ]);
    const retainedDuplicate = analyzed.items.find((item) => item.id === 'p2');
    expect(retainedDuplicate?.duplicateStatus).toBe('confirmed_duplicate');

    const report = calculateTravelReport(analyzed.items, null, null, false, 100);
    expect(report.grandTotalAmount).toBe(100);
  });
});
