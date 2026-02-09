
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './FileUpload';
import { SmartFile, SmartFileAnalysis } from '../types';
import { classifyDocument, Provider } from '../services/paddleService';
import { fileToBase64, extractTextFromDocx, convertDocxToImage, convertImageToPdf, packageAndDownloadFiles } from '../services/fileService';
import { FileThumbnail } from './FileThumbnail';

interface OrganizerModeProps {
  provider: Provider;
  apiKey: string;
  modelName: string;
  onApplicationContextFound: (start: string, end: string) => void;
  onTransferFiles: (files: SmartFile[]) => void;
}

export const OrganizerMode: React.FC<OrganizerModeProps> = ({ 
    provider, apiKey, modelName, onApplicationContextFound, onTransferFiles 
}) => {
  const [smartFiles, setSmartFiles] = useState<SmartFile[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [detectedDate, setDetectedDate] = useState<{start: string, end: string} | null>(null);
  
  // Ref to track if we should process more
  const processingRef = useRef(false);

  const handleOrganizerSelect = (files: File[]) => {
    const newFiles: SmartFile[] = files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        originalFile: f,
        status: 'pending',
        selected: true
    }));
    setSmartFiles(prev => [...prev, ...newFiles]);
  };

  // Concurrency Controller
  useEffect(() => {
    const CONCURRENCY_LIMIT = 3; // Process 3 files at once

    const processQueue = async () => {
        if (processingRef.current) return; // Prevent loop reentry
        processingRef.current = true;

        // Find files that need processing
        // We need to look at state, but using functional updates inside the loop or
        // checking a fresh reference is tricky in useEffect. 
        // Instead, we will iterate until we fill the concurrency slots.
        
        // However, a simpler way in React is:
        // 1. Identify how many are 'analyzing'.
        // 2. If < LIMIT, find 'pending' ones and start them.
        
        // We use a local calculation here because state updates are async
        const currentlyAnalyzing = smartFiles.filter(f => f.status === 'analyzing').length;
        const slotsAvailable = CONCURRENCY_LIMIT - currentlyAnalyzing;
        
        if (slotsAvailable <= 0) {
            processingRef.current = false;
            return;
        }

        const pendingFiles = smartFiles.filter(f => f.status === 'pending').slice(0, slotsAvailable);
        
        if (pendingFiles.length === 0) {
            processingRef.current = false;
            return;
        }

        // Mark them as analyzing immediately to prevent duplicate pickups
        setSmartFiles(prev => prev.map(f => 
            pendingFiles.some(p => p.id === f.id) ? { ...f, status: 'analyzing' } : f
        ));
        
        // Start async operations
        pendingFiles.forEach(async (file) => {
            try {
                await analyzeSingleFile(file);
            } finally {
                // When done, force a re-check of the queue via dependency change
                // Note: updating state (setSmartFiles) will trigger useEffect again
            }
        });

        processingRef.current = false;
    };

    processQueue();
  }, [smartFiles]); // Run whenever file list status changes

  const analyzeSingleFile = async (pending: SmartFile) => {
      try {
        let input: { file: File, base64?: string, textContent?: string } = { file: pending.originalFile };
        const fileType = pending.originalFile.type;
        
        if (fileType.includes('image') || fileType.includes('pdf')) {
            const b64 = await fileToBase64(pending.originalFile);
            input.base64 = b64.split(',')[1];
        } else if (fileType.includes('word') || pending.originalFile.name.endsWith('.docx') || pending.originalFile.name.endsWith('.doc')) {
            if (pending.originalFile.name.endsWith('.doc')) {
                throw new Error('暂不支持 .doc 格式，请转换为 .docx 或导出为 PDF');
            }
            if (provider !== 'kimi') {
                const dataUrl = await convertDocxToImage(pending.originalFile);
                input.base64 = dataUrl.split(',')[1];
                const text = await extractTextFromDocx(pending.originalFile);
                input.textContent = text;
            } else {
                const text = await extractTextFromDocx(pending.originalFile);
                input.textContent = text;
            }
        } 

        const analysis = await classifyDocument(input, provider, apiKey, modelName);
        
        if (analysis.fileType === 'application' && analysis.applicationData) {
            const { startDate, endDate } = analysis.applicationData;
            if (startDate && endDate) {
                setDetectedDate({ start: startDate, end: endDate });
                onApplicationContextFound(startDate, endDate);
            }
        }

        let processedFile: File | Blob | undefined = undefined;
        if (fileType.startsWith('image/')) {
            processedFile = await convertImageToPdf(pending.originalFile);
        }

        setSmartFiles(prev => prev.map(f => f.id === pending.id ? { 
            ...f, 
            status: 'success', 
            analysis,
            processedFile,
            selected: analysis.isReimbursable 
        } : f));

    } catch (e: any) {
        console.error("Analysis failed", e);
        setSmartFiles(prev => prev.map(f => f.id === pending.id ? { ...f, status: 'error', error: e.message } : f));
    }
  };

  const handleDownloadPackage = () => {
      const sorted = [...smartFiles]
        .filter(f => f.status === 'success')
        .sort((a, b) => (a.analysis?.sortCategory || 99) - (b.analysis?.sortCategory || 99));
      packageAndDownloadFiles(sorted);
  };

  const handleTransfer = () => {
      const toTransfer = smartFiles.filter(f => f.status === 'success' && f.analysis?.isReimbursable && f.selected);
      onTransferFiles(toTransfer);
  };

  const activeWorkers = smartFiles.filter(f => f.status === 'analyzing').length;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
        {/* Header Section */}
        <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                    </span>
                    归档机器人
                </h3>
                <p className="text-sm text-gray-500 mt-1 pl-10">自动分类、重命名并整理您的发票和申请单</p>
            </div>
            
            {smartFiles.length > 0 && (
                <button 
                    onClick={handleDownloadPackage} 
                    className="group flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-green-400 hover:text-green-600 hover:shadow-sm transition-all text-sm font-medium apple-press"
                >
                    <svg className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                    下载整理包
                </button>
            )}
        </div>

        <div className="p-6 space-y-6">
            <FileUpload onFileSelect={handleOrganizerSelect} isLoading={false} multiple={true} compact={smartFiles.length > 0} />
            
            {detectedDate && (
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 animate-fade-in flex items-center">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <svg className="w-24 h-24 text-blue-900" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                    </div>
                    <div className="flex-shrink-0 bg-blue-100 text-blue-600 p-2 rounded-lg mr-4 relative z-10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="relative z-10">
                        <h4 className="text-sm font-bold text-blue-900">已提取出差申请信息</h4>
                        <p className="text-xs text-blue-700 mt-0.5">
                            行程日期：<span className="font-mono font-medium">{detectedDate.start}</span> 至 <span className="font-mono font-medium">{detectedDate.end}</span>
                        </p>
                    </div>
                </div>
            )}
            
            {smartFiles.length > 0 && (
                <div>
                    <div className="flex justify-between items-center mb-4 px-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">处理队列</span>
                        {activeWorkers > 0 && (
                            <div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                <span className="text-[10px] font-medium">{activeWorkers} 个任务并行处理中...</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
                        <table className="min-w-full divide-y divide-gray-50">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16">选择</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">原始文件</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI 建议命名</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">文件类型</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                                {[...smartFiles].sort((a,b) => (a.analysis?.sortCategory || 99) - (b.analysis?.sortCategory || 99)).map((file, idx) => (
                                    <tr key={file.id} className="group hover:bg-gray-50 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {file.status === 'success' ? (
                                                <input 
                                                    type="checkbox" 
                                                    checked={file.selected}
                                                    onChange={() => setSmartFiles(prev => prev.map(f => f.id === file.id ? { ...f, selected: !f.selected } : f))}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin"></div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="mr-3">
                                                    <FileThumbnail file={file.originalFile} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 max-w-[150px] truncate" title={file.originalFile.name}>{file.originalFile.name}</div>
                                                    {file.status === 'error' && <div className="text-[10px] text-red-500 mt-0.5">{file.error}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {file.analysis ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-800">
                                                        <span className="text-gray-300 mr-2 text-xs">{idx + 1}.</span>
                                                        {file.analysis.suggestedName}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 mt-0.5">{file.analysis.summary}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300 italic">等待分析...</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {file.analysis && (
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className={`px-2.5 py-0.5 inline-flex text-[10px] font-bold uppercase tracking-wide rounded-full ${
                                                        file.analysis.isReimbursable ? 'bg-green-50 text-green-700 border border-green-100' : 
                                                        file.analysis.fileType === 'application' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {file.analysis.fileType === 'application' ? '出差申请' : file.analysis.isReimbursable ? '需报销' : '其他附件'}
                                                    </span>
                                                    {file.processedFile && <span className="text-[9px] text-blue-500 font-medium">+ 转为PDF</span>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-end gap-4 items-center">
                        <div className="text-xs text-gray-500">
                            已选 <span className="font-bold text-gray-900">{smartFiles.filter(f => f.selected && f.analysis?.isReimbursable).length}</span> 张报销凭证
                        </div>
                        <button 
                            onClick={handleTransfer}
                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg hover:bg-black hover:shadow-xl transition transform hover:-translate-y-0.5 flex items-center"
                        >
                            导入计算器
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
