
export enum InvoiceType {
  SPECIAL = '增值税专用发票',
  GENERAL = '普通发票',
  OTHER = '其他'
}

// Detailed category for travel expenses
export enum TravelExpenseType {
  TRAIN = '火车票',
  FLIGHT = '机票', // Includes reschedule fees usually
  TAXI = '市内交通', // Taxi, Ride-hailing
  ACCOMMODATION = '住宿费',
  TRAINING = '培训费',
  DINING = '餐饮费',
  OTHER = '其他'
}

export enum ExpenseCategory {
  DINING = '餐饮费',
  ACCOMMODATION = '住宿费',
  OTHER = '其他'
}

export interface ExtractedInvoiceData {
  invoiceType: InvoiceType;
  expenseType: TravelExpenseType;
  buyerName: string;
  buyerTaxId: string;
  totalAmount: number;
  taxRate: string;
  taxAmount: number;
  invoiceDate: string; // YYYY-MM-DD
  items: string[];
  // New Fields
  isRefundDetected?: boolean; 
  documentType?: string; // e.g. 'vat_invoice', 'boarding_pass', 'screenshot'
}

// Result from the Classifier AI
export interface SmartFileAnalysis {
  fileType: 'invoice' | 'application' | 'notification' | 'other'; // Broad type
  isReimbursable: boolean; // Should this participate in calculation?
  suggestedName: string; // "发票_餐饮_321元_2025.12.31"
  sortCategory: number; // 1:Application, 2:InterCity, 3:Accom, 4:Training, 5:Taxi, 6:Notification
  summary: string; // Brief description
  extractedData?: ExtractedInvoiceData; // If it is an invoice, keep the data
  // New: Application Specific Data
  applicationData?: {
    startDate?: string;
    endDate?: string;
    location?: string;
  }
}

export interface SmartFile {
  id: string;
  originalFile: File;
  processedFile?: File | Blob; // The renamed or converted file
  status: 'pending' | 'analyzing' | 'success' | 'error';
  analysis?: SmartFileAnalysis;
  error?: string;
  selected: boolean; // User confirmed to include
}

export interface ValidationRuleResult {
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'success';
}

export interface AuditResult {
  companyMatch: ValidationRuleResult;
  invoiceTypeCheck: ValidationRuleResult;
  generalStatus: 'valid' | 'warning' | 'invalid';
}

export interface DiningPlan {
  applicationDate: string;
  estimatedAmount: number;
  totalPeople: number;
  staffCount: number;
  guestCount: number;
  notes: string[];
}

export interface DiningApplicationData {
  isDiningApplication?: boolean;
  title?: string;
  applicationDate: string;
  estimatedAmount: number;
  totalPeople: number;
  staffCount: number;
  guestCount: number;
}

export interface ProcessedResult {
  data: ExtractedInvoiceData;
  audit: AuditResult;
  category: ExpenseCategory;
  diningPlan?: DiningPlan;
}

export interface TravelBatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: ExtractedInvoiceData;
  error?: string;
  refundStatus?: 'pending_confirmation' | 'confirmed_refund' | 'confirmed_failed';
  validationErrors?: string[]; // Array of compliance error messages
  yearConfirm?: {
    suggestedYear: number;
    altYear: number;
    month: number;
    day: number;
  };
}

export interface TravelReport {
  startDate: string;
  endDate: string;
  totalDays: number;
  allowancePerDay: number;
  totalAllowance: number;
  interCityAmount: number;
  interCityTax: number;
  intraCityAmount: number;
  intraCityTax: number;
  accommodationAmount: number;
  accommodationTax: number;
  trainingAmount: number;
  trainingTax: number;
  diningAmount: number;
  diningTax: number;
  grandTotalAmount: number;
  grandTotalTax: number;
  standardCount: number;
  standardAmount: number;
  nonStandardCount: number;
  nonStandardAmount: number;
  nonStandardDetails: string[];
}
