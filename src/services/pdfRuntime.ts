import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: typeof getDocument;
      GlobalWorkerOptions: typeof GlobalWorkerOptions;
    };
  }
}

let initialized = false;

export const initializePdfRuntime = () => {
  if (initialized) return;
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  window.pdfjsLib = {
    getDocument,
    GlobalWorkerOptions,
  };
  initialized = true;
};

export { getDocument };
