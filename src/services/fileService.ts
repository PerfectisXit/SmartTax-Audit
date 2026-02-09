
import JSZip from 'jszip';
import saveAs from 'file-saver';
import * as mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SmartFile, ProcessedResult, ExpenseCategory } from '../types';

// Helper: Convert File to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper: Convert File to ArrayBuffer
export const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Extract Text from Word Doc
export const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await fileToArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.substring(0, 3000); // Limit context for LLM
  } catch (e) {
    console.warn("Mammoth extraction failed", e);
    return "Word Document Content (Extraction Failed)";
  }
};

// Convert DOCX to a single image (data URL) for vision models
export const convertDocxToImage = async (file: File): Promise<string> => {
  const arrayBuffer = await fileToArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value || '<p>(空文档)</p>';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 width at 96dpi
  container.style.padding = '40px';
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = 'Arial, sans-serif';
  container.innerHTML = html;

  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
    return canvas.toDataURL('image/jpeg', 0.95);
  } finally {
    document.body.removeChild(container);
  }
};

// Convert Image File to PDF Blob
export const convertImageToPdf = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const imgData = reader.result as string;
      const img = new Image();
      img.src = imgData;
      img.onload = () => {
        // Calculate dimensions to fit A4
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        const widthRatio = pageWidth / img.width;
        const heightRatio = pageHeight / img.height;
        const ratio = Math.min(widthRatio, heightRatio) * 0.9; // 90% fit
        
        const canvasWidth = img.width * ratio;
        const canvasHeight = img.height * ratio;
        const marginX = (pageWidth - canvasWidth) / 2;
        const marginY = (pageHeight - canvasHeight) / 2;

        doc.addImage(imgData, 'JPEG', marginX, marginY, canvasWidth, canvasHeight);
        resolve(doc.output('blob'));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Zip and Download Files
export const packageAndDownloadFiles = async (smartFiles: SmartFile[]) => {
  const zip = new JSZip();

  for (let i = 0; i < smartFiles.length; i++) {
    const item = smartFiles[i];
    if (!item.analysis) continue;

    // Determine filename with index
    // e.g. "1. 出差申请单.pdf"
    const index = i + 1;
    let extension = item.originalFile.name.split('.').pop()?.toLowerCase() || '';
    
    // If we converted it (processedFile exists), typically it's a PDF now (unless it was docx kept as is)
    let content: Blob | File = item.processedFile || item.originalFile;
    
    if (item.processedFile && item.originalFile.type.startsWith('image/')) {
        extension = 'pdf'; // Converted image to pdf
    }

    const filename = `${index}. ${item.analysis.suggestedName}.${extension}`;
    zip.file(filename, content);
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `智能归档_差旅报销附件包_${new Date().toISOString().split('T')[0]}.zip`);
};

const sanitizeFilename = (name: string) => {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 120);
};

export const buildAuditFilename = (result: ProcessedResult) => {
  const amount = result.data.totalAmount.toFixed(2);
  const date = result.data.invoiceDate || '未知日期';
  const buyer = result.data.buyerName || '未知购买方';
  const suffix = result.category === ExpenseCategory.DINING
    ? '餐饮票'
    : result.category === ExpenseCategory.ACCOMMODATION
      ? '住宿费票'
      : '票据';
  return sanitizeFilename(`${amount}_${date}_${buyer}_${suffix}`);
};

export const buildDiningApplicationFilename = (amount: number, date: string) => {
  const amt = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  const safeDate = date || '未知日期';
  return sanitizeFilename(`招待费申请单_${amt}_${safeDate}`);
};

export const downloadRenamedAuditFile = (file: File, result: ProcessedResult) => {
  const ext = file.name.split('.').pop() || '';
  const filename = `${buildAuditFilename(result)}${ext ? `.${ext}` : ''}`;
  saveAs(file, filename);
};

export const downloadRenamedDiningApplication = (file: File, amount: number, date: string) => {
  const ext = file.name.split('.').pop() || '';
  const filename = `${buildDiningApplicationFilename(amount, date)}${ext ? `.${ext}` : ''}`;
  saveAs(file, filename);
};

export const packageAndDownloadAuditFiles = async (items: Array<{ file: File; result: ProcessedResult }>) => {
  const zip = new JSZip();
  const nameCount: Record<string, number> = {};

  for (const item of items) {
    const ext = item.file.name.split('.').pop() || '';
    const base = buildAuditFilename(item.result);
    const count = (nameCount[base] || 0) + 1;
    nameCount[base] = count;
    const filename = `${base}${count > 1 ? `_${count}` : ''}${ext ? `.${ext}` : ''}`;
    zip.file(filename, item.file);
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `票据审核_改名下载_${new Date().toISOString().split('T')[0]}.zip`);
};
