import { ProviderKey, sendVisionRequest } from "../providerAdapter";
import { getDocument } from "../pdfRuntime";

export type Provider = ProviderKey;

const inferTaskType = (systemPrompt: string): 'invoice' | 'classifier' | 'dining_application' => {
  if (systemPrompt.includes('isDiningApplication')) return 'dining_application';
  if (systemPrompt.includes('fileType') && systemPrompt.includes('sortCategory')) return 'classifier';
  return 'invoice';
};

const base64ToUint8Array = (base64Data: string): Uint8Array => {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const convertPdfToImage = async (base64Data: string): Promise<string> => {
  const loadingTask = getDocument({ data: base64ToUint8Array(base64Data) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewportBase = page.getViewport({ scale: 1.0 });
  const targetWidth = 2500;
  const scale = Math.min(targetWidth / viewportBase.width, 3.0);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (!context) throw new Error("Canvas context error");

  await page.render({ canvasContext: context, viewport: viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
};

const optimizeImage = async (base64Data: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
    img.src = src;

    img.onload = () => {
      const targetWidth = 2500;
      let width = img.width;
      let height = img.height;

      if (width > targetWidth) {
        height = Math.round(height * (targetWidth / width));
        width = targetWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context failed"));
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]);
    };
    img.onerror = () => reject(new Error("Image load failed for optimization"));
  });
};

export const dispatchAIRequest = async (
  file: File | undefined,
  base64: string | undefined,
  provider: Provider,
  apiKey: string,
  modelName: string,
  systemPrompt: string
): Promise<string> => {
  let finalBase64 = base64;

  if (provider !== 'kimi') {
    if (file?.type === 'application/pdf' && base64) {
      finalBase64 = await convertPdfToImage(base64);
    } else if (base64) {
      finalBase64 = await optimizeImage(base64);
    } else {
      throw new Error("Base64 content required for non-Kimi providers");
    }
  }

  const data = await sendVisionRequest({
    provider,
    file,
    base64: finalBase64,
    apiKey,
    model: modelName,
    systemPrompt,
    taskType: inferTaskType(systemPrompt)
  });
  const resultText = data.choices?.[0]?.message?.content;
  if (!resultText) throw new Error("API Returned Empty Content");
  return resultText;
};
