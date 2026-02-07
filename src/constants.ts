export const COMPANY_TAX_MAP: Record<string, string> = {
  '南京中交万正置业有限公司': '913201143027142012',
  '南京中交建设发展有限公司': '91320191MA20G3MJ1W',
  '南京中交置业投资有限公司': '91320111MA1YNFJM72',
  '南京中交置业有限公司': '9132011130263843XM'
};

// Simple holiday lookup (Mock for demonstration, ideally fetched from an API)
export const HOLIDAYS_2024 = [
  '2024-01-01', '2024-02-10', '2024-02-11', '2024-02-12', 
  '2024-04-04', '2024-05-01', '2024-06-10', '2024-09-17', 
  '2024-10-01', '2024-10-02', '2024-10-03'
];

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
