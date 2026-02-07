import { ExtractedInvoiceData, AuditResult, ProcessedResult, ExpenseCategory, InvoiceType, DiningPlan, TravelExpenseType, DiningApplicationData } from '../types';
import { DEFAULT_DINING_RULES, resolveStaffRange } from './diningRules';
import { COMPANY_TAX_MAP, HOLIDAYS_2024 } from '../constants';

// Helper to check if a date is a weekend or holiday
const isNonWorkingDay = (date: Date): boolean => {
  const day = date.getDay();
  const dateString = date.toISOString().split('T')[0];
  // 0 is Sunday, 6 is Saturday
  return day === 0 || day === 6 || HOLIDAYS_2024.includes(dateString);
};

// Calculate the working day before a given date
const getPreviousWorkingDay = (invoiceDateStr: string): string => {
  let current = new Date(invoiceDateStr);
  // Start checking from the day before
  current.setDate(current.getDate() - 1);

  // Look back up to 7 days
  for (let i = 0; i < 7; i++) {
    if (!isNonWorkingDay(current)) {
      return current.toISOString().split('T')[0];
    }
    current.setDate(current.getDate() - 1);
  }
  
  // Fallback: if we can't find a working day in the past week (unlikely), use invoice date
  return invoiceDateStr;
};

export const detectCategory = (data: ExtractedInvoiceData): ExpenseCategory => {
  if (data.expenseType === TravelExpenseType.ACCOMMODATION) return ExpenseCategory.ACCOMMODATION;
  if (data.expenseType === TravelExpenseType.DINING) return ExpenseCategory.DINING;
  const combinedItems = data.items.join(' ').toLowerCase();
  
  // Priority Change: Check Accommodation FIRST.
  // Reason: Hotel invoices often contain "Dining" (e.g. "Hotel & Dining Co." or "Breakfast included"),
  // but if "Accommodation/Room" is present, it is primarily an Accommodation expense.
  if (combinedItems.includes('住宿') || combinedItems.includes('房费') || combinedItems.includes('客房') || combinedItems.includes('酒店')) {
    return ExpenseCategory.ACCOMMODATION;
  }
  
  if (combinedItems.includes('餐饮') || combinedItems.includes('餐费') || combinedItems.includes('饮食') || combinedItems.includes('美食')) {
    return ExpenseCategory.DINING;
  }
  
  return ExpenseCategory.OTHER;
};

export const generateDiningPlan = (data: ExtractedInvoiceData): DiningPlan => {
  const actualAmount = data.totalAmount;
  
  // Rule 2b: Estimated amount must be multiple of 150 AND > actual amount
  let factor = Math.floor(actualAmount / 150) + 1;
  let estimatedAmount = factor * 150;

  // Rule 2c: Headcount
  const totalPeople = estimatedAmount / 150;
  
  // Rule 2c: Accompanying staff (max 3)
  let staffCount = 0;
  if (totalPeople <= 1) {
      staffCount = 0; 
  } else {
      // Max 3 staff, but keep at least 1 guest slot open
      staffCount = Math.min(totalPeople - 1, 3);
  }
  const guestCount = totalPeople - staffCount;

  // Rule 2a: Date calculation
  const appDate = getPreviousWorkingDay(data.invoiceDate);

  return {
    applicationDate: appDate,
    estimatedAmount,
    totalPeople,
    staffCount,
    guestCount,
    notes: [
      `申请单日期: ${appDate} (基于发票日期 ${data.invoiceDate} 前推工作日)`,
      `预计金额: ${estimatedAmount}元 (实际金额 ${actualAmount}元)`,
      `人员分配: 总${totalPeople}人 (陪同${staffCount}人, 招待${guestCount}人)`
    ]
  };
};

export const validateDiningApplicationAgainstInvoice = (
  application: DiningApplicationData,
  invoice: ExtractedInvoiceData
): string[] => {
  const issues: string[] = [];
  const plan = generateDiningPlan(invoice);
  const derivedTotal = application.staffCount + application.guestCount;
  const totalPeople = application.totalPeople > 0 ? application.totalPeople : derivedTotal;

  if (!application.estimatedAmount || application.estimatedAmount <= 0) {
    issues.push('请填写申请金额');
  }
  if (DEFAULT_DINING_RULES.requireAmountGreaterThanInvoice && application.estimatedAmount <= invoice.totalAmount) {
    issues.push(`申请金额必须大于发票金额（申请 ${application.estimatedAmount} / 发票 ${invoice.totalAmount}）`);
  }
  if (application.estimatedAmount % DEFAULT_DINING_RULES.amountMultiple !== 0) {
    issues.push(`申请金额需为 ${DEFAULT_DINING_RULES.amountMultiple} 的整数倍（当前 ${application.estimatedAmount}）`);
  }
  if (application.staffCount < DEFAULT_DINING_RULES.baseStaffMin || application.staffCount > DEFAULT_DINING_RULES.baseStaffMax) {
    issues.push(`陪同人数应为 ${DEFAULT_DINING_RULES.baseStaffMin}-${DEFAULT_DINING_RULES.baseStaffMax} 人（当前 ${application.staffCount}）`);
  }
  if (application.totalPeople > 0 && derivedTotal !== application.totalPeople) {
    issues.push(`陪同人数 + 招待人数应等于总人数（${application.staffCount}+${application.guestCount} ≠ ${application.totalPeople}）`);
  }
  if (totalPeople <= 0) {
    issues.push('请填写陪同人数与招待人数');
  } else {
    const range = resolveStaffRange(totalPeople, DEFAULT_DINING_RULES);
    if (application.staffCount < range.staffMin || application.staffCount > range.staffMax) {
      issues.push(`${range.label}时，陪同人数建议 ${range.staffMin}-${range.staffMax} 人（当前 ${application.staffCount}）`);
    }
  }
  if (application.applicationDate && application.applicationDate !== plan.applicationDate) {
    issues.push(`申请单日期应为 ${plan.applicationDate}（当前 ${application.applicationDate}）`);
  }
  if (!application.applicationDate) {
    issues.push('请填写申请单日期');
  }

  return issues;
};

export const auditInvoice = (data: ExtractedInvoiceData): ProcessedResult => {
  const category = detectCategory(data);
  const audit: AuditResult = {
    companyMatch: { passed: true, message: '公司名称与税号匹配 ✅', severity: 'success' },
    invoiceTypeCheck: { passed: true, message: '发票类型符合要求 ✅', severity: 'success' },
    generalStatus: 'valid'
  };

  // 1. Validate Company Info
  const expectedTaxId = COMPANY_TAX_MAP[data.buyerName];
  if (!expectedTaxId) {
    audit.companyMatch = { 
      passed: false, 
      message: `警告: 未知公司名称 "${data.buyerName}"。请人工核对税号。 ⚠️`, 
      severity: 'warning' 
    };
  } else if (expectedTaxId !== data.buyerTaxId) {
    audit.companyMatch = { 
      passed: false, 
      message: `错误: 税号不匹配! \n发票: ${data.buyerTaxId} \n系统: ${expectedTaxId} ❌`, 
      severity: 'error' 
    };
    audit.generalStatus = 'invalid';
  }

  // 2. Validate Accommodation Invoice Type
  if (category === ExpenseCategory.ACCOMMODATION || data.expenseType === TravelExpenseType.ACCOMMODATION) {
    if (data.invoiceType !== InvoiceType.SPECIAL) {
      audit.invoiceTypeCheck = {
        passed: false,
        message: '住宿费必须开具增值税专用发票，当前为普通发票。不可报销 ❌',
        severity: 'error'
      };
      audit.generalStatus = 'invalid';
    }
  }

  // 3. Generate Dining Plan if applicable
  let diningPlan: DiningPlan | undefined;
  if (category === ExpenseCategory.DINING && audit.generalStatus !== 'invalid') {
    diningPlan = generateDiningPlan(data);
  }

  return {
    data,
    audit,
    category,
    diningPlan
  };
};

// New: Batch Validator for Travel Items
const parseDateParts = (dateStr: string) => {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
};

export const validateTravelBatchItem = (
  data: ExtractedInvoiceData, 
  appStart?: string, 
  appEnd?: string
): { errors: string[]; normalizedDate?: string; yearConfirm?: { suggestedYear: number; altYear: number; month: number; day: number } } => {
    const errors: string[] = [];
    
    // 1. Basic Audit Reuse (Tax ID & Accom Type)
    // We only care about errors/warnings here
    const basicAudit = auditInvoice(data);
    
    if (basicAudit.audit.generalStatus === 'invalid' || basicAudit.audit.generalStatus === 'warning') {
       if (!basicAudit.audit.companyMatch.passed) {
           errors.push(basicAudit.audit.companyMatch.message);
       }
       if (!basicAudit.audit.invoiceTypeCheck.passed) {
           errors.push(basicAudit.audit.invoiceTypeCheck.message);
       }
    }

    // 2. Date Check for Tickets against Application Range
    // Only check if we have application dates AND it's a Train or Flight ticket
    let normalizedDate: string | undefined = undefined;
    let yearConfirm: { suggestedYear: number; altYear: number; month: number; day: number } | undefined = undefined;

    if (appStart && appEnd) {
        if (data.expenseType === TravelExpenseType.TRAIN || data.expenseType === TravelExpenseType.FLIGHT) {
             const parts = parseDateParts(data.invoiceDate);
             const start = new Date(appStart);
             const end = new Date(appEnd);
             const appYearStart = start.getFullYear();
             const appYearEnd = end.getFullYear();

             if (parts && appYearStart === appYearEnd) {
                 const appStartMonth = start.getMonth() + 1;
                 const appEndMonth = end.getMonth() + 1;
                 const isYearEndTrip = appStartMonth >= 11 || appEndMonth >= 11;
                 const isPossibleNextYear = isYearEndTrip && parts.month <= 2;

                 if (isPossibleNextYear) {
                     yearConfirm = {
                       suggestedYear: appYearStart + 1,
                       altYear: appYearStart,
                       month: parts.month,
                       day: parts.day
                     };
                 } else {
                     normalizedDate = `${appYearStart}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
                 }
             }

             const compareDateStr = normalizedDate || data.invoiceDate;
             const ticketDate = new Date(compareDateStr);
             ticketDate.setHours(0,0,0,0);
             start.setHours(0,0,0,0);
             end.setHours(0,0,0,0);

             if (!yearConfirm && (ticketDate < start || ticketDate > end)) {
                 errors.push(`行程日期异常: 车票日期(${compareDateStr}) 不在申请单范围(${appStart} ~ ${appEnd}) 内 ❌`);
             }
        }
    }
    
    return { errors, normalizedDate, yearConfirm };
};
