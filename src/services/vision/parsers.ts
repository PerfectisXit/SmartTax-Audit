import { DiningApplicationData, ExtractedInvoiceData, InvoiceType, SmartFileAnalysis, TravelExpenseType } from "../../types";
import { z } from 'zod';

const InvoiceRawSchema = z.object({
  invoiceTitle: z.string().optional(),
  invoiceType: z.string().optional(),
  expenseType: z.string().optional(),
  documentType: z.string().optional(),
  isRefundDetected: z.union([z.boolean(), z.string(), z.number()]).optional(),
  buyerName: z.string().optional(),
  buyerTaxId: z.string().optional(),
  totalAmount: z.union([z.number(), z.string()]).optional(),
  taxRate: z.string().optional(),
  taxAmount: z.union([z.number(), z.string()]).optional(),
  invoiceDate: z.string().optional(),
  items: z.array(z.string()).optional()
}).passthrough();

const ClassifierOutputSchema = z.object({
  fileType: z.string().optional(),
  isReimbursable: z.union([z.boolean(), z.string(), z.number()]).optional(),
  suggestedName: z.string().optional(),
  sortCategory: z.union([z.number(), z.string()]).optional(),
  summary: z.string().optional(),
  extractedData: z.unknown().optional(),
  applicationData: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    location: z.string().optional()
  }).optional()
}).passthrough();

const DiningApplicationOutputSchema = z.object({
  isDiningApplication: z.union([z.boolean(), z.string(), z.number()]).optional(),
  title: z.string().optional(),
  applicationDate: z.string().optional(),
  estimatedAmount: z.union([z.number(), z.string()]).optional(),
  totalPeople: z.union([z.number(), z.string()]).optional(),
  staffCount: z.union([z.number(), z.string()]).optional(),
  guestCount: z.union([z.number(), z.string()]).optional()
}).passthrough();

export const extractJsonFromText = (text: string): unknown => {
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

export const parseAmount = (val: unknown) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let clean = val.replace(/,/g, '');
    clean = clean.replace(/[^\d.-]/g, '');
    return parseFloat(clean) || 0;
  }
  return 0;
};

export const normalizeInvoiceData = (raw: unknown): ExtractedInvoiceData => {
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

  const parsedRaw = InvoiceRawSchema.safeParse(raw);
  if (!parsedRaw.success) return defaultResult;
  const safeRaw = parsedRaw.data;

  let type = InvoiceType.OTHER;
  const classificationSource = `${safeRaw.invoiceTitle || ""}${safeRaw.invoiceType || ""}`;
  if (classificationSource.includes('专用')) type = InvoiceType.SPECIAL;
  else if (classificationSource.includes('普通')) type = InvoiceType.GENERAL;
  else if (safeRaw.invoiceType?.includes('普票')) type = InvoiceType.GENERAL;
  else if (safeRaw.invoiceType?.includes('专票')) type = InvoiceType.SPECIAL;
  else if (safeRaw.expenseType && ['机票', '火车票', '市内交通'].includes(safeRaw.expenseType)) type = InvoiceType.GENERAL;

  let expenseType = TravelExpenseType.OTHER;
  const et = safeRaw.expenseType || "";
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
    documentType: safeRaw.documentType || 'other',
    isRefundDetected: Boolean(safeRaw.isRefundDetected),
    buyerName: safeRaw.buyerName || "未识别",
    buyerTaxId: safeRaw.buyerTaxId || "",
    totalAmount: parseAmount(safeRaw.totalAmount),
    taxRate: safeRaw.taxRate || "",
    taxAmount: parseAmount(safeRaw.taxAmount),
    invoiceDate: safeRaw.invoiceDate || defaultResult.invoiceDate,
    items: Array.isArray(safeRaw.items) ? safeRaw.items : []
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
    const raw = extractJsonFromText(text);
    const validated = ClassifierOutputSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error('分类输出结构不合法');
    }
    const parsed = validated.data;
    const safeFileType = ['invoice', 'application', 'notification', 'other'].includes(parsed.fileType || '')
      ? parsed.fileType as SmartFileAnalysis['fileType']
      : 'other';
    const safeSortCategory = Number(parsed.sortCategory);
    const normalizedSortCategory = Number.isFinite(safeSortCategory) ? safeSortCategory : 99;
    const normalizedReimbursable = parsed.isReimbursable === true || parsed.isReimbursable === 'true' || parsed.isReimbursable === 1 || parsed.isReimbursable === '1';

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
      fileType: safeFileType,
      isReimbursable: normalizedReimbursable,
      suggestedName: safeName,
      sortCategory: normalizedSortCategory,
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
    const raw = extractJsonFromText(text);
    const validated = DiningApplicationOutputSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error('申请单输出结构不合法');
    }
    const parsed = validated.data;
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
