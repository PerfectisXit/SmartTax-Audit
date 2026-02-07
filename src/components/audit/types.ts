import { DiningApplicationData, ProcessedResult } from "../../types";

export type AuditItemStatus = 'pending' | 'processing' | 'success' | 'error';
export type AuditItemKind = 'invoice' | 'application';

export interface AuditItem {
  id: string;
  file: File;
  status: AuditItemStatus;
  kind?: AuditItemKind;
  result?: ProcessedResult;
  error?: string;
  diningIssues?: string[];
}

export interface DiningAppState {
  file?: File;
  status: 'idle' | 'processing' | 'success' | 'error';
  data?: DiningApplicationData;
  error?: string;
}

export interface AuditStats {
  total: number;
  processing: number;
  success: number;
  errorCount: number;
  diningCount: number;
  issueCount: number;
}
