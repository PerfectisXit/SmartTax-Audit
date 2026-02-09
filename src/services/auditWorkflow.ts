import { analyzeDiningApplication, analyzeInvoice, Provider } from './paddleService';

export interface FilePayload {
  dataUrl: string;
  mimeType: string;
  content: string;
}

export const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
  });
};

export const buildFilePayload = async (file: File): Promise<FilePayload> => {
  const dataUrl = await readFileAsDataUrl(file);
  const mimeType = dataUrl.split(';')[0].split(':')[1];
  const content = dataUrl.split(',')[1];
  return { dataUrl, mimeType, content };
};

export const detectDiningApplication = async (
  file: File,
  provider: Provider,
  apiKey: string,
  modelName: string
) => {
  const { content, mimeType } = await buildFilePayload(file);
  return analyzeDiningApplication(file, content, mimeType, provider, apiKey, modelName);
};

export const detectInvoice = async (
  file: File,
  provider: Provider,
  apiKey: string,
  modelName: string
) => {
  const { content, mimeType } = await buildFilePayload(file);
  return analyzeInvoice(file, content, mimeType, provider, apiKey, modelName);
};
