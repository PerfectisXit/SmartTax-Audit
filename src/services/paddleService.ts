
import { ExtractedInvoiceData, SmartFileAnalysis, DiningApplicationData } from "../types";
import { CLASSIFIER_SYSTEM_PROMPT, DINING_APPLICATION_PROMPT, INVOICE_SYSTEM_PROMPT } from "./vision/promptTemplates";
import { parseClassifierOutput, parseDiningApplicationOutput, parseInvoiceOutput } from "./vision/parsers";
import { dispatchAIRequest } from "./vision/visionClient";
import type { Provider } from "./vision/visionClient";

export type { Provider } from "./vision/visionClient";

export const analyzeInvoice = async (
  file: File, 
  base64Content: string, 
  mimeType: string, 
  provider: Provider, 
  apiKey: string,
  modelName: string
): Promise<ExtractedInvoiceData> => {
  if (!modelName) throw new Error("未指定模型名称");
  
  try {
    const text = await dispatchAIRequest(file, base64Content, provider, apiKey, modelName, INVOICE_SYSTEM_PROMPT);
    return parseInvoiceOutput(text);
  } catch (error: any) {
    console.error(`Extraction Error (${provider}):`, error);
    if (error.message.includes('API Key')) throw error;
    throw new Error(`${provider} 调用失败: ${error.message}`);
  }
};

export const classifyDocument = async (
    input: { file: File, base64?: string, textContent?: string },
    provider: Provider,
    apiKey: string,
    modelName: string
): Promise<SmartFileAnalysis> => {
    if (!modelName) throw new Error("未指定模型名称");

    try {
        let promptWithContext = CLASSIFIER_SYSTEM_PROMPT;
        if (input.textContent) {
            promptWithContext += `\n\nDocument Text Content:\n${input.textContent}`;
        }
        
        const text = await dispatchAIRequest(input.file, input.base64, provider, apiKey, modelName, promptWithContext);
        return parseClassifierOutput(text);

    } catch (error: any) {
        console.error(`Classification Error (${provider}):`, error);
        throw new Error(`${provider} 分类失败: ${error.message}`);
    }
};

export const analyzeInvoiceWithPaddle = async () => {
  throw new Error("Deprecated");
};

export const analyzeDiningApplication = async (
  file: File,
  base64Content: string,
  mimeType: string,
  provider: Provider,
  apiKey: string,
  modelName: string
): Promise<DiningApplicationData> => {
  if (!modelName) throw new Error("未指定模型名称");

  try {
    const text = await dispatchAIRequest(file, base64Content, provider, apiKey, modelName, DINING_APPLICATION_PROMPT);
    return parseDiningApplicationOutput(text);
  } catch (error: any) {
    console.error(`Dining Application Error (${provider}):`, error);
    throw new Error(`${provider} 申请单识别失败: ${error.message}`);
  }
};
