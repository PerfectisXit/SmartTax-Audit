import React, { useEffect, useState } from 'react';

interface ImagePreviewProps {
  file: File | null;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ file }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    if (file.type === 'application/pdf') {
      setIsPdf(true);
      renderPdf(file);
    } else {
      setIsPdf(false);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const renderPdf = async (file: File) => {
    try {
      if (!window.pdfjsLib) return;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const scale = 2.0; 
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        setPreviewUrl(canvas.toDataURL('image/jpeg'));
      }
    } catch (e) {
      console.error("PDF Preview Error", e);
    }
  };

  if (!previewUrl) return null;

  return (
    <>
      <div 
        className="relative group rounded-xl overflow-hidden bg-gray-100 border border-gray-200 cursor-zoom-in transition-all duration-300 hover:shadow-lg"
        onClick={() => setIsZoomed(true)}
      >
        {/* Subtle patterned background for transparency */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

        <div className="absolute top-3 right-3 z-10">
           <div className="bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1 group-hover:translate-y-0 flex items-center gap-1">
             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
             点击放大
           </div>
        </div>

        <img 
          src={previewUrl} 
          alt="Invoice Preview" 
          className="relative w-full h-auto object-contain block min-h-[200px]" 
        />
        
        {isPdf && (
           <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/80 to-transparent text-white text-[10px] font-medium py-2 px-3 pt-6 text-center backdrop-blur-[1px]">
             PDF 格式 - 第 1 页预览
           </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 cursor-zoom-out animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <img 
            src={previewUrl} 
            alt="Invoice Fullscreen" 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
          />
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};