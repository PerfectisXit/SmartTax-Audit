
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface FileThumbnailProps {
  file: File;
}

export const FileThumbnail: React.FC<FileThumbnailProps> = ({ file }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [highResUrl, setHighResUrl] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [loading, setLoading] = useState(false);
  const thumbObjectUrlRef = useRef<string | null>(null);
  const highResObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) return;
    
    let active = true;

    const generateThumb = async () => {
        if (file.type === 'application/pdf') {
            if (!window.pdfjsLib) return;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                // Render small thumbnail
                const viewport = page.getViewport({ scale: 0.5 }); 
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    if (active) setThumbUrl(canvas.toDataURL('image/jpeg'));
                }
            } catch (e) {
                console.error("Thumb error", e);
            }
        } else if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            thumbObjectUrlRef.current = url;
            if (active) setThumbUrl(url);
        }
    };
    generateThumb();
    return () => {
      active = false;
      if (thumbObjectUrlRef.current) {
        URL.revokeObjectURL(thumbObjectUrlRef.current);
        thumbObjectUrlRef.current = null;
      }
      if (highResObjectUrlRef.current) {
        URL.revokeObjectURL(highResObjectUrlRef.current);
        highResObjectUrlRef.current = null;
      }
    };
  }, [file]);

  const handleZoom = async () => {
      setIsZoomed(true);
      if (highResUrl) return; // Already generated

      if (file.type === 'application/pdf') {
          setLoading(true);
          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            // Render high res
            const viewport = page.getViewport({ scale: 2.0 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                setHighResUrl(canvas.toDataURL('image/jpeg'));
            }
          } catch(e) { console.error(e); }
          setLoading(false);
      } else if (file.type.startsWith('image/')) {
          if (highResUrl) return;
          const url = URL.createObjectURL(file);
          highResObjectUrlRef.current = url;
          setHighResUrl(url);
      }
  };

  return (
    <>
        <div 
            className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in relative bg-gray-50 hover:opacity-80 transition shadow-sm group"
            onClick={handleZoom}
            title="点击放大预览"
        >
            {thumbUrl ? (
                <img src={thumbUrl} alt="thumbnail" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-gray-400 bg-gray-50">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    {file.name.split('.').pop()?.toUpperCase().slice(0,3)}
                </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
        </div>

        {isZoomed && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
          >
            {loading ? (
              <div className="flex flex-col items-center text-white/80">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                加载高清预览中...
              </div>
            ) : (
              <img 
                src={highResUrl || thumbUrl || ''} 
                alt="Full Preview" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded"
              />
            )}
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              onClick={() => setIsZoomed(false)}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
              {file.name}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
