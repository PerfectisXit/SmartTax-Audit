export const COMPANY_TAX_MAP: Record<string, string> = {
  '南京中交万正置业有限公司': '913201143027142012',
  '南京中交建设发展有限公司': '91320191MA20G3MJ1W',
  '南京中交置业投资有限公司': '91320111MA1YNFJM72',
  '南京中交置业有限公司': '9132011130263843XM'
};

// Simple holiday lookup (Mock for demonstration, ideally fetched from an API)
export const HOLIDAYS_BY_YEAR: Record<number, string[]> = {
  2024: [
  '2024-01-01', '2024-02-10', '2024-02-11', '2024-02-12', 
  '2024-04-04', '2024-05-01', '2024-06-10', '2024-09-17', 
  '2024-10-01', '2024-10-02', '2024-10-03'
  ],
  2025: [
    '2025-01-01',
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
    '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
    '2025-04-04', '2025-04-05', '2025-04-06',
    '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
    '2025-05-31', '2025-06-01', '2025-06-02',
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
    '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08'
  ],
  2026: [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
    '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
    '2026-04-04', '2026-04-05', '2026-04-06',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    '2026-06-19', '2026-06-20', '2026-06-21',
    '2026-09-25', '2026-09-26', '2026-09-27',
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    '2026-10-05', '2026-10-06', '2026-10-07'
  ]
};

export const getHolidayList = (year: number): string[] => {
  return HOLIDAYS_BY_YEAR[year] || [];
};

export const SYSTEM_INSTRUCTION = `
You are an expert OCR and financial data extraction AI specializing in Chinese VAT Invoices (fapiao).
Your job is to extract specific fields accurately from an image of an invoice.
Return ONLY valid JSON.
Fields to extract:
- invoiceType: "增值税专用发票" or "普通发票" (Look for "专用" vs "普通" in the title)
- buyerName: The name of the purchaser/company (购买方名称)
- buyerTaxId: The tax ID of the purchaser (购买方纳税人识别号)
- totalAmount: The total amount with tax (价税合计/小写) - Number only
- taxRate: The tax rate detected (税率) - String (e.g., "6%")
- taxAmount: The tax amount (税额) - Number
- invoiceDate: The date (开票日期) - Format YYYY-MM-DD
- items: An array of item names (货物或应税劳务、服务名称) to help categorize as Dining (餐饮) or Accommodation (住宿).
`;
