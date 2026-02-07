import { DiningApplicationData, ExtractedInvoiceData, InvoiceType, SmartFileAnalysis, TravelExpenseType } from "../../types";

export const extractJsonFromText = (text: string): any => {
  let jsonString = text.trim();
  const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonString = jsonMatch[1] || jsonMatch[0];
  }
  jsonString = jsonString.replace(/,\s*}/g, '}');
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Raw JSON Parse Failed:", jsonString);
    throw e;
  }
};

export const parseAmount = (val: any) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let clean = val.replace(/,/g, '');
    clean = clean.replace(/[^\d.-]/g, '');
    return parseFloat(clean) || 0;
  }
  return 0;
};

export const normalizeInvoiceData = (raw: any): ExtractedInvoiceData => {
  const defaultResult: ExtractedInvoiceData = {
    invoiceType: InvoiceType.OTHER,
    expenseType: TravelExpenseType.OTHER,
    documentType: 'other',
    isRefundDetected: false,
    buyerName: "未识别",
    buyerTaxId: "未识别",
    totalAmount: 0,
    taxRate: "",
    taxAmount: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    items: []
  };

  if (!raw) return defaultResult;

  let type = InvoiceType.OTHER;
  const classificationSource = (raw.invoiceTitle || "") + (raw.invoiceType || "");
  if (classificationSource.includes('专用')) type = InvoiceType.SPECIAL;
  else if (classificationSource.includes('普通')) type = InvoiceType.GENERAL;
  else if (raw.invoiceType?.includes('普票')) type = InvoiceType.GENERAL;
  else if (raw.invoiceType?.includes('专票')) type = InvoiceType.SPECIAL;
  else if (['机票', '火车票', '市内交通'].includes(raw.expenseType)) type = InvoiceType.GENERAL;

  let expenseType = TravelExpenseType.OTHER;
  const et = raw.expenseType || "";
  if (et.includes("火车")) expenseType = TravelExpenseType.TRAIN;
  else if (et.includes("机票") || et.includes("航空")) expenseType = TravelExpenseType.FLIGHT;
  else if (et.includes("市内") || et.includes("出租") || et.includes("网约") || et.includes("客运")) expenseType = TravelExpenseType.TAXI;
  else if (et.includes("住宿") || et.includes("酒店")) expenseType = TravelExpenseType.ACCOMMODATION;
  else if (et.includes("培训")) expenseType = TravelExpenseType.TRAINING;
  else if (et.includes("餐饮")) expenseType = TravelExpenseType.DINING;

  return {
    ...defaultResult,
    invoiceType: type,
    expenseType: expenseType,
    documentType: raw.documentType || 'other',
    isRefundDetected: !!raw.isRefundDetected,
    buyerName: raw.buyerName || "未识别",
    buyerTaxId: raw.buyerTaxId || "",
    totalAmount: parseAmount(raw.totalAmount),
    taxRate: raw.taxRate || "",
    taxAmount: parseAmount(raw.taxAmount),
    invoiceDate: raw.invoiceDate || defaultResult.invoiceDate,
    items: Array.isArray(raw.items) ? raw.items : []
  };
};

export const fallbackRegexParser = (text: string, defaultResult: ExtractedInvoiceData): ExtractedInvoiceData => {
  const result = { ...defaultResult };
  if (text.match(/专用发票/)) result.invoiceType = InvoiceType.SPECIAL;
  else if (text.match(/普通发票/)) result.invoiceType = InvoiceType.GENERAL;

  if (text.includes("住宿") || text.includes("酒店")) result.expenseType = TravelExpenseType.ACCOMMODATION;
  else if (text.includes("出租") || text.includes("运输")) result.expenseType = TravelExpenseType.TAXI;
  else if (text.includes("登机牌") || text.includes("行程单")) result.expenseType = TravelExpenseType.FLIGHT;

  if (text.includes("退票") || text.includes("退款")) result.isRefundDetected = true;

  const dateMatch = text.match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})/);
  if (dateMatch) result.invoiceDate = `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`;

  const amountMatch = text.match(/(价税合计|金额|总额|Total).*?(\d{1,3}(,\d{3})*(\.\d{2})?)/i);
  if (amountMatch) {
    const rawNum = amountMatch[2].replace(/,/g, '');
    result.totalAmount = parseFloat(rawNum);
  }

  return result;
};

export const parseInvoiceOutput = (text: string): ExtractedInvoiceData => {
  try {
    const parsed = extractJsonFromText(text);
    return normalizeInvoiceData(parsed);
  } catch (e) {
    console.warn("JSON parsing failed, using fallback", e);
    return fallbackRegexParser(text, {
      invoiceType: InvoiceType.OTHER,
      expenseType: TravelExpenseType.OTHER,
      buyerName: "",
      buyerTaxId: "",
      totalAmount: 0,
      taxRate: "",
      taxAmount: 0,
      invoiceDate: "",
      items: []
    });
  }
};

export const parseClassifierOutput = (text: string): SmartFileAnalysis => {
  try {
    const parsed = extractJsonFromText(text);

    let safeName = parsed.suggestedName || '未命名文件';
    safeName = safeName.replace(/Notification/gi, "通知")
      .replace(/Invoice/gi, "发票")
      .replace(/Receipt/gi, "收据")
      .replace(/Application/gi, "申请单")
      .replace(/Payment/gi, "付款凭证")
      .replace(/Ticket/gi, "票据")
      .replace(/Hotel/gi, "酒店")
      .replace(/Flight/gi, "机票")
      .replace(/Train/gi, "火车票")
      .replace(/Taxi/gi, "打车票");

    let extractedData: ExtractedInvoiceData | undefined = undefined;
    if (parsed.extractedData && (parsed.fileType === 'invoice' || parsed.isReimbursable)) {
      extractedData = normalizeInvoiceData(parsed.extractedData);
    }

    return {
      fileType: parsed.fileType || 'other',
      isReimbursable: typeof parsed.isReimbursable === 'boolean' ? parsed.isReimbursable : false,
      suggestedName: safeName,
      sortCategory: parsed.sortCategory || 99,
      summary: parsed.summary || '',
      applicationData: parsed.applicationData,
      extractedData: extractedData
    };
  } catch (e) {
    throw new Error("分类失败，AI 返回格式异常");
  }
};

export const parseDiningApplicationOutput = (text: string): DiningApplicationData => {
  try {
    const parsed = extractJsonFromText(text);
    return {
      isDiningApplication: Boolean(parsed.isDiningApplication),
      title: parsed.title || "",
      applicationDate: parsed.applicationDate || "",
      estimatedAmount: parseAmount(parsed.estimatedAmount),
      totalPeople: Number(parsed.totalPeople) || 0,
      staffCount: Number(parsed.staffCount) || 0,
      guestCount: Number(parsed.guestCount) || 0
    };
  } catch (e) {
    throw new Error("申请单识别失败，AI 返回格式异常");
  }
};
