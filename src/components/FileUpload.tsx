
import React from 'react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  isLoading: boolean;
  multiple?: boolean;
  compact?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading, multiple = false, compact = false }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // Convert FileList to Array
      const fileList = Array.from(event.target.files);
      onFileSelect(fileList);
      // Reset value so same file can be selected again if needed
      event.target.value = '';
    }
  };

  if (compact) {
     return (
        <div className="w-full">
            <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload-compact"
                disabled={isLoading}
                multiple={multiple}
            />
            <label
                htmlFor="file-upload-compact"
                className={`flex items-center justify-center space-x-2 w-full py-3 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-400 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="text-sm font-semibold text-blue-600">添加更多发票</span>
            </label>
        </div>
     );
  }

  return (
    <div className="w-full">
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        disabled={isLoading}
        multiple={multiple}
      />
      <label
        htmlFor="file-upload"
        className={`group relative flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
          ${isLoading 
            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
            : 'border-gray-300 bg-gray-50 hover:bg-blue-50/50 hover:border-blue-400 hover:shadow-md'
          }
        `}
      >
        {/* Animated Icon Wrapper */}
        <div className={`w-20 h-20 mb-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${isLoading ? '' : 'group-hover:text-blue-600'}`}>
          <svg 
            className={`w-10 h-10 ${isLoading ? 'text-gray-300' : 'text-blue-500'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <div className="text-center px-4">
          <p className="text-lg font-bold text-gray-700 mb-1 group-hover:text-blue-700 transition-colors">
            {multiple ? '点击上传一批发票' : '点击上传发票文件'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            支持 <span className="font-medium text-gray-600">JPG, PNG</span> 图片或 <span className="font-medium text-gray-600">PDF</span> 电子发票
          </p>
          <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors
             ${isLoading ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:bg-blue-700'}
          `}>
             选择文件
          </span>
        </div>
      </label>
    </div>
  );
};
