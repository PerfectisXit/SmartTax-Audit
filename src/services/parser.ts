import { ExtractedInvoiceData, InvoiceType, TravelExpenseType } from "../types";
import { COMPANY_TAX_MAP } from "../constants";

export const parseInvoiceText = (lines: string[]): ExtractedInvoiceData => {
  const fullText = lines.join(' ');
  
  // 1. Detect Invoice Type
  let invoiceType = InvoiceType.OTHER;
  if (fullText.includes('专用发票')) invoiceType = InvoiceType.SPECIAL;
  else if (fullText.includes('普通发票')) invoiceType = InvoiceType.GENERAL;

  // 2. Extract Date (YYYY年MM月DD日)
  let invoiceDate = new Date().toISOString().split('T')[0];
  const dateRegex = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
  const dateMatch = fullText.match(dateRegex);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    invoiceDate = `${year}-${month}-${day}`;
  }

  // 3. Extract Amounts
  // Look for "小写" or "¥" near "合计"
  // Logic: Filter lines that look like prices, sort by value. 
  // The largest value is usually the Total Amount (价税合计).
  const moneyRegex = /[¥￥]?\s*(\d{1,3}(,\d{3})*(\.\d{2})?)\b/g;
  const numbers: number[] = [];
  
  lines.forEach(line => {
    // Clean line to make matching easier
    const cleanLine = line.replace(/\s/g, '');
    
    // Explicitly look for Total Amount line
    if (cleanLine.includes('价税合计') || cleanLine.includes('小写')) {
      const match = cleanLine.match(/(\d+\.\d{2})/);
      if (match) numbers.push(parseFloat(match[1]));
    }
  });

  // Fallback: Find all numbers and guess
  if (numbers.length === 0) {
    const matches = fullText.match(moneyRegex);
    if (matches) {
      matches.forEach(m => {
        const num = parseFloat(m.replace(/[¥￥,]/g, ''));
        if (!isNaN(num)) numbers.push(num);
      });
    }
  }

  // Sort descending. Max is usually Total Amount.
  numbers.sort((a, b) => b - a);
  const totalAmount = numbers[0] || 0;
  
  // Tax Amount is usually smaller. Rough heuristic: Total / (1+rate) * rate. 
  // Let's look for explicit "税额" line
  let taxAmount = 0;
  lines.forEach(line => {
    if (line.includes('税额') && /\d/.test(line)) {
      const match = line.match(/(\d+\.\d{2})/);
      if (match) taxAmount = parseFloat(match[1]);
    }
  });
  if (taxAmount === 0 && numbers.length > 1) {
     // If we found multiple numbers, maybe the second largest is pre-tax, and difference is tax?
     // Or find a small number that looks like tax.
     // Let's just default to 0 if not explicitly found to trigger manual check.
  }


  // 4. Buyer Info
  // Match against known company list (Fuzzy match)
  let buyerName = "";
  let buyerTaxId = "";

  const knownCompanies = Object.keys(COMPANY_TAX_MAP);
  for (const company of knownCompanies) {
    if (fullText.includes(company)) {
      buyerName = company;
      buyerTaxId = COMPANY_TAX_MAP[company]; // Default to known map if name matches
      break;
    }
  }

  // If no name match, try to find Tax ID via Regex
  if (!buyerTaxId) {
    // 15-20 alphanumeric, often starts with 9
    const taxIdRegex = /[0-9A-Z]{18}/; 
    const taxMatch = fullText.match(taxIdRegex);
    if (taxMatch) buyerTaxId = taxMatch[0];
  }

  // 5. Items (for categorization)
  // Simple keyword extraction from lines
  const items: string[] = [];
  const keywords = ['餐饮', '服务费', '住宿', '客房', '餐费', '食品', '酒店'];
  lines.forEach(line => {
    for (const kw of keywords) {
      if (line.includes(kw)) {
        items.push(line);
        break;
      }
    }
  });

  // 6. Expense Type Detection
  let expenseType = TravelExpenseType.OTHER;
  if (fullText.includes('火车') || fullText.includes('高铁') || fullText.includes('动车')) {
    expenseType = TravelExpenseType.TRAIN;
  } else if (fullText.includes('机票') || fullText.includes('航空') || fullText.includes('行程单')) {
    expenseType = TravelExpenseType.FLIGHT;
  } else if (fullText.includes('出租') || fullText.includes('客运') || fullText.includes('滴滴') || fullText.includes('打车')) {
    expenseType = TravelExpenseType.TAXI;
  } else if (fullText.includes('住宿') || fullText.includes('酒店') || fullText.includes('宾馆') || fullText.includes('房费')) {
    expenseType = TravelExpenseType.ACCOMMODATION;
  } else if (fullText.includes('培训费')) {
    expenseType = TravelExpenseType.TRAINING;
  }

  return {
    invoiceType,
    expenseType,
    buyerName: buyerName || "未识别 (请人工核对)",
    buyerTaxId: buyerTaxId || "未识别",
    totalAmount,
    taxRate: "N/A", // Hard to extract without spatial logic
    taxAmount,
    invoiceDate,
    items: items.length > 0 ? items : ["未识别明细"]
  };
};
