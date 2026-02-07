
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileUpload } from './FileUpload';
import { TravelBatchItem, TravelExpenseType, TravelReport, SmartFile } from '../types';
import { analyzeInvoice, Provider } from '../services/paddleService';
import { runConcurrent } from '../services/taskQueue';
import { calculateTravelReport } from '../services/travelService';
import { startBatchUsage, endBatchUsage } from '../services/usageService';
import { validateTravelBatchItem } from '../services/auditService';
import { FileThumbnail } from './FileThumbnail';

interface CalculatorModeProps {
  provider: Provider;
  apiKey: string;
  modelName: string;
  initialSmartFiles?: SmartFile[]; // Changed from initialFiles to SmartFile[] to carry data
  applicationContext: { start?: string, end?: string };
}

export const CalculatorMode: React.FC<CalculatorModeProps> = ({ 
    provider, apiKey, modelName, initialSmartFiles, applicationContext 
}) => {
  const [calcItems, setCalcItems] = useState<TravelBatchItem[]>([]);
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 30;
  
  // Settings
  const [enableAllowance, setEnableAllowance] = useState(true);
  const [allowanceRate, setAllowanceRate] = useState(100);
  const [manualStartDate, setManualStartDate] = useState<string>(applicationContext.start || '');
  const [manualEndDate, setManualEndDate] = useState<string>(applicationContext.end || '');

  const processingRef = useRef(false);
  const prevCountRef = useRef(0);

  // Handle incoming initial smart files
  // Optimization: If extractedData exists, mark as success immediately and skip processing
  useEffect(() => {
      if (initialSmartFiles && initialSmartFiles.length > 0) {
          const newItems: TravelBatchItem[] = initialSmartFiles.map(sf => {
              const hasData = !!sf.analysis?.extractedData;
              let item: TravelBatchItem = {
                  id: sf.id, // Preserve ID
                  file: sf.originalFile,
                  status: hasData ? 'success' : 'pending',
                  result: sf.analysis?.extractedData,
                  refundStatus: sf.analysis?.extractedData?.isRefundDetected ? 'pending_confirmation' : undefined
              };

              // If we have data, we must run validation locally since we skip the processing loop
              if (hasData && item.result) {
                  const start = manualStartDate || applicationContext.start;
                  const end = manualEndDate || applicationContext.end;
                  const validation = validateTravelBatchItem(item.result, start, end);
                  if (validation.normalizedDate) {
                      item.result = { ...item.result, invoiceDate: validation.normalizedDate };
                  }
                  item.validationErrors = validation.errors;
                  item.yearConfirm = validation.yearConfirm;
              }

              return item;
          });
          
          // Only add items that are not already in the list (though normally this component mounts fresh)
          setCalcItems(newItems);
      }
  }, [initialSmartFiles, applicationContext]);

  // Handle Context Updates
  useEffect(() => {
      if (applicationContext.start) setManualStartDate(applicationContext.start);
      if (applicationContext.end) setManualEndDate(applicationContext.end);
  }, [applicationContext]);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (prev === 0 && calcItems.length > 0) {
      startBatchUsage('差旅报销');
    }
    if (prev > 0 && calcItems.length === 0) {
      endBatchUsage();
    }
    prevCountRef.current = calcItems.length;
  }, [calcItems.length]);

  // Concurrent Queue Processor
  // Only picks up items with status 'pending'
  useEffect(() => {
    const CONCURRENCY_LIMIT = 3;

    const processQueue = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      const currentlyProcessing = calcItems.filter(i => i.status === 'processing').length;
      const slotsAvailable = CONCURRENCY_LIMIT - currentlyProcessing;

      if (slotsAvailable <= 0) {
        processingRef.current = false;
        return;
      }

      const pendingItems = calcItems.filter(i => i.status === 'pending').slice(0, slotsAvailable);

      if (pendingItems.length === 0) {
        processingRef.current = false;
        return;
      }

      setCalcItems(prev => prev.map(i =>
        pendingItems.some(p => p.id === i.id) ? { ...i, status: 'processing' } : i
      ));

      await runConcurrent(pendingItems, slotsAvailable, async (item) => {
        await processSingleItem(item);
      });

      processingRef.current = false;
    };

    processQueue();
  }, [calcItems, apiKey, provider, modelName, manualStartDate, manualEndDate, applicationContext]);

  const processSingleItem = async (pendingItem: TravelBatchItem) => {
      try {
        const reader = new FileReader();
        const readPromise = new Promise<{content: string, mime: string}>((resolve, reject) => {
             reader.onload = () => {
                 const res = reader.result as string;
                 resolve({
                     content: res.split(',')[1],
                     mime: res.split(';')[0].split(':')[1]
                 });
             };
             reader.onerror = reject;
             reader.readAsDataURL(pendingItem.file);
        });

        const { content, mime } = await readPromise;
        const data = await analyzeInvoice(pendingItem.file, content, mime, provider, apiKey, modelName);
        
        const start = manualStartDate || applicationContext.start;
        const end = manualEndDate || applicationContext.end;
        const validation = validateTravelBatchItem(data, start, end);
        const finalData = validation.normalizedDate ? { ...data, invoiceDate: validation.normalizedDate } : data;
        
        setCalcItems(prev => prev.map(i => i.id === pendingItem.id ? { 
            ...i, 
            status: 'success', 
            result: finalData,
            validationErrors: validation.errors,
            yearConfirm: validation.yearConfirm,
            refundStatus: data.isRefundDetected ? 'pending_confirmation' : undefined
        } : i));
      } catch (e: any) {
         console.error("Processing failed for item", pendingItem.id, e);
         setCalcItems(prev => prev.map(i => i.id === pendingItem.id ? { ...i, status: 'error', error: e.message || "Unknown error" } : i));
      }
  };

  const handleCalcFilesSelect = (files: File[]) => {
    const newItems: TravelBatchItem[] = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      status: 'pending'
    }));
    setCalcItems(prev => [...prev, ...newItems]);
  };

  const removeCalcItem = (id: string) => {
    setCalcItems(prev => prev.filter(i => i.id !== id));
  };

  const updateRefundStatus = (id: string, status: 'confirmed_refund' | 'confirmed_failed') => {
      setCalcItems(prev => prev.map(i => i.id === id ? { ...i, refundStatus: status } : i));
  };

  const confirmYear = (id: string, year: number) => {
      setCalcItems(prev => prev.map(i => {
          if (i.id !== id || !i.result || !i.yearConfirm) return i;
          const { month, day } = i.yearConfirm;
          const newDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const start = manualStartDate || applicationContext.start;
          const end = manualEndDate || applicationContext.end;
          const validation = validateTravelBatchItem({ ...i.result, invoiceDate: newDate }, start, end);
          return {
              ...i,
              result: { ...i.result, invoiceDate: newDate },
              validationErrors: validation.errors,
              yearConfirm: validation.yearConfirm
          };
      }));
  };

  const report: TravelReport = useMemo(() => {
    return calculateTravelReport(
        calcItems, 
        manualStartDate || null, 
        manualEndDate || null, 
        enableAllowance, 
        allowanceRate
    );
  }, [calcItems, manualStartDate, manualEndDate, enableAllowance, allowanceRate]);

  useEffect(() => {
     if (!manualStartDate && report.startDate) setManualStartDate(report.startDate);
     if (!manualEndDate && report.endDate) setManualEndDate(report.endDate);
  }, [report.startDate, report.endDate]);

  const getExpenseTypeBadge = (type: TravelExpenseType) => {
     const styles = {
         [TravelExpenseType.TRAIN]: 'bg-blue-50 text-blue-700 border-blue-100',
         [TravelExpenseType.FLIGHT]: 'bg-sky-50 text-sky-700 border-sky-100',
         [TravelExpenseType.TAXI]: 'bg-yellow-50 text-yellow-700 border-yellow-100',
         [TravelExpenseType.ACCOMMODATION]: 'bg-indigo-50 text-indigo-700 border-indigo-100',
         [TravelExpenseType.TRAINING]: 'bg-purple-50 text-purple-700 border-purple-100',
         [TravelExpenseType.DINING]: 'bg-rose-50 text-rose-700 border-rose-100',
         [TravelExpenseType.OTHER]: 'bg-gray-50 text-gray-700 border-gray-200',
     };
     return styles[type] || styles[TravelExpenseType.OTHER];
  };

  const isCalcProcessing = calcItems.some(i => i.status === 'processing');
  const activeWorkers = calcItems.filter(i => i.status === 'processing').length;
  const totalPages = Math.max(1, Math.ceil(calcItems.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (listPage - 1) * PAGE_SIZE;
    return calcItems.slice(start, start + PAGE_SIZE);
  }, [calcItems, listPage]);

  useEffect(() => {
    if (listPage > totalPages) setListPage(totalPages);
    if (listPage < 1) setListPage(1);
  }, [listPage, totalPages]);

  return (
    <div className="grid lg:grid-cols-12 gap-8 items-start animate-fade-in pb-12">
      {/* Left Column: Invoice Stream */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
           <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold text-gray-800 flex items-center">
                 <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg mr-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 4h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </span>
                 1. 批量审核发票
               </h3>
               {calcItems.length > 0 && (
                   <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded">共 {calcItems.length} 张</span>
               )}
           </div>

           <FileUpload onFileSelect={handleCalcFilesSelect} isLoading={false} multiple={true} compact={calcItems.length > 0} />
           
           {calcItems.length > 0 && (
             <div className="mt-6 space-y-4">
               {isCalcProcessing && (
                  <div className="flex items-center justify-center p-3 mb-2 text-xs text-blue-600 bg-blue-50/50 rounded-lg border border-blue-100 animate-pulse-subtle">
                     <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     AI 正在并行读取票据信息 ({activeWorkers} 个任务)...
                  </div>
               )}
               
               <div className="max-h-[700px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                 {pagedItems.map(item => (
                   <div key={item.id} className={`group relative bg-white border rounded-2xl p-4 transition-all duration-300 hover:shadow-md ${item.result?.isRefundDetected ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100 hover:border-blue-200'}`}>
                      <div className="flex items-start gap-4">
                          {/* Status Icon & Thumbnail */}
                          <div className="flex-shrink-0 mt-1 flex flex-col items-center gap-2">
                             {item.status === 'pending' && <div className="w-2.5 h-2.5 bg-gray-300 rounded-full"></div>}
                             {item.status === 'processing' && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                             {item.status === 'success' && !item.validationErrors?.length && <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                             {item.status === 'success' && item.validationErrors && item.validationErrors.length > 0 && <div className="w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>}
                             {item.status === 'error' && <div className="w-5 h-5 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center">!</div>}
                             
                             <FileThumbnail file={item.file} />
                          </div>
                          
                          {/* Main Content */}
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]" title={item.file.name}>{item.file.name}</p>
                                    {item.result ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className={`font-mono ${item.validationErrors?.some(e => e.includes('日期') || e.includes('年份')) ? 'text-red-500' : 'text-gray-400'}`}>
                                              {item.result.invoiceDate}
                                            </span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className={`px-1.5 py-0.5 rounded border ${getExpenseTypeBadge(item.result.expenseType)}`}>{item.result.expenseType}</span>
                                            {item.result.documentType === 'screenshot' && <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">截图</span>}
                                        </div>
                                    ) : (
                                        <div className="text-xs">
                                            {item.status === 'processing' ? (
                                                <span className="text-blue-600 font-medium flex items-center">
                                                     <svg className="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                     正在智能提取信息...
                                                </span>
                                            ) : item.status === 'error' ? (
                                                <span className="text-red-500 flex items-center">
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    识别失败: {item.error || '未知错误'}
                                                </span>
                                            ) : (
                                                 <span className="text-gray-400 flex items-center">
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    已加入队列，等待处理...
                                                 </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {item.result && (
                                    <div className="text-right">
                                        <div className={`text-base font-bold font-mono ${item.refundStatus === 'confirmed_refund' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                            <span className="text-xs text-gray-400 mr-0.5">¥</span>
                                            {item.result.totalAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            税额 ¥{item.result.taxAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
                                            {item.result.taxRate ? ` · 税率 ${item.result.taxRate}` : ''}
                                        </div>
                                        {item.refundStatus === 'confirmed_refund' && <span className="text-[10px] text-red-500 bg-red-50 px-1 rounded">已剔除</span>}
                                    </div>
                                )}
                             </div>
                             
                             {/* Validation Errors Pill List */}
                             {item.validationErrors && item.validationErrors.length > 0 && (
                                 <div className="mt-2 flex flex-wrap gap-1.5">
                                     {item.validationErrors.map((err, i) => (
                                         <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-100">
                                             {err}
                                         </span>
                                     ))}
                                 </div>
                             )}

                             {/* Refund Action Area */}
                             {item.result?.isRefundDetected && item.refundStatus !== 'confirmed_refund' && item.refundStatus !== 'confirmed_failed' && (
                                 <div className="mt-3 p-3 bg-white border border-orange-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                     <div className="flex items-center gap-2 text-xs text-orange-800">
                                       <span className="bg-orange-100 p-1 rounded text-orange-600">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                       </span>
                                       <span>系统检测到“退票”字样，是否剔除？</span>
                                     </div>
                                     <div className="flex gap-2">
                                        <button 
                                          onClick={() => updateRefundStatus(item.id, 'confirmed_refund')}
                                          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm apple-press"
                                        >
                                           剔除
                                        </button>
                                        <button 
                                          onClick={() => updateRefundStatus(item.id, 'confirmed_failed')}
                                          className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition apple-press"
                                        >
                                           正常报销
                                        </button>
                                     </div>
                                 </div>
                             )}
                              {item.yearConfirm && (
                                  <div className="mt-3 p-3 bg-white border border-blue-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                      <div className="flex items-center gap-2 text-xs text-blue-800">
                                        <span className="bg-blue-100 p-1 rounded text-blue-600">
                                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </span>
                                        <span>票据未识别年份，请确认年份</span>
                                      </div>
                                      <div className="flex gap-2">
                                         <button 
                                           onClick={() => confirmYear(item.id, item.yearConfirm!.altYear)}
                                           className="px-3 py-1.5 text-xs bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition apple-press"
                                         >
                                            使用 {item.yearConfirm.altYear} 年
                                         </button>
                                         <button 
                                           onClick={() => confirmYear(item.id, item.yearConfirm!.suggestedYear)}
                                           className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm apple-press"
                                         >
                                            使用 {item.yearConfirm.suggestedYear} 年
                                         </button>
                                      </div>
                                  </div>
                              )}
                          </div>

                          <button 
                            onClick={() => removeCalcItem(item.id)}
                            className="text-gray-300 hover:text-red-400 p-1 rounded-md hover:bg-red-50 transition"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      </div>
                   </div>
                 ))}
               </div>
               {calcItems.length > PAGE_SIZE && (
                 <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                   <button
                     onClick={() => setListPage(p => Math.max(1, p - 1))}
                     className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 apple-press"
                   >
                     上一页
                   </button>
                   <span>第 {listPage} / {totalPages} 页</span>
                   <button
                     onClick={() => setListPage(p => Math.min(totalPages, p + 1))}
                     className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 apple-press"
                   >
                     下一页
                   </button>
                 </div>
               )}
             </div>
           )}
        </div>
      </div>

      {/* Right Column: Settings & Summary */}
      <div className="lg:col-span-5 space-y-6">
         {/* Settings Panel */}
         <div className="apple-card-soft p-6 apple-hover apple-press">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
               <span className="p-1.5 bg-gray-100 text-gray-600 rounded-lg mr-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
               </span>
               2. 报销参数
            </h3>
            
            <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                   <label className="text-sm font-medium text-gray-900">启用出差补贴</label>
                   <button 
                     onClick={() => setEnableAllowance(!enableAllowance)}
                     className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${enableAllowance ? 'bg-blue-600' : 'bg-gray-300'}`}
                   >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${enableAllowance ? 'translate-x-5' : 'translate-x-0'}`}></div>
                   </button>
                </div>

                <div className={`transition-all duration-300 overflow-hidden ${enableAllowance ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                   <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">每日补贴标准 (元)</label>
                   <input 
                     type="number" 
                     value={allowanceRate} 
                     onChange={(e) => setAllowanceRate(Number(e.target.value))}
                     className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">开始日期</label>
                       <input 
                         type="date" 
                         value={manualStartDate}
                         onChange={(e) => setManualStartDate(e.target.value)}
                         className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">结束日期</label>
                       <input 
                         type="date" 
                         value={manualEndDate}
                         onChange={(e) => setManualEndDate(e.target.value)}
                         className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                       />
                    </div>
                </div>
                {applicationContext.start && (
                    <div className="flex items-start text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <svg className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        已自动同步申请单中的行程日期
                    </div>
                )}
            </div>
         </div>

         {/* Report Summary - Table Layout */}
         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <span className="p-1.5 bg-gray-100 text-gray-600 rounded-lg mr-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </span>
                  3. 报销汇总
               </h3>
               <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase tracking-widest">TOTAL DAYS</div>
                  <div className="text-lg font-bold font-mono text-gray-900">{report.totalDays} <span className="text-sm text-gray-500 font-sans">天</span></div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 pb-2 border-b border-gray-100 uppercase tracking-wider">
               <div>类目</div>
               <div className="text-right">金额</div>
               <div className="text-right">税额</div>
            </div>

            <div className="divide-y divide-gray-100 text-sm">
               <div className="grid grid-cols-3 py-2">
                  <div className="text-gray-700 font-medium">城市间交通</div>
                  <div className="text-right font-semibold text-gray-900">¥{report.interCityAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                  <div className="text-right text-gray-500">¥{report.interCityTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
               <div className="grid grid-cols-3 py-2">
                  <div className="text-gray-700 font-medium">市内交通</div>
                  <div className="text-right font-semibold text-gray-900">¥{report.intraCityAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                  <div className="text-right text-gray-500">¥{report.intraCityTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
               <div className="grid grid-cols-3 py-2">
                  <div className="text-gray-700 font-medium">住宿费</div>
                  <div className="text-right font-semibold text-gray-900">¥{report.accommodationAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                  <div className="text-right text-gray-500">¥{report.accommodationTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
               <div className="grid grid-cols-3 py-2">
                  <div className="text-gray-700 font-medium">培训费</div>
                  <div className="text-right font-semibold text-gray-900">¥{report.trainingAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                  <div className="text-right text-gray-500">¥{report.trainingTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
               <div className="grid grid-cols-3 py-2">
                  <div className="text-gray-700 font-medium">餐饮费</div>
                  <div className="text-right font-semibold text-gray-900">¥{report.diningAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                  <div className="text-right text-gray-500">¥{report.diningTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
               {enableAllowance && (
                 <div className="grid grid-cols-3 py-2">
                   <div className="text-gray-700 font-medium">出差补贴</div>
                   <div className="text-right font-semibold text-gray-900">¥{report.totalAllowance.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                   <div className="text-right text-gray-500">—</div>
                 </div>
               )}
            </div>

            {report.nonStandardDetails.length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-800">
                <span className="font-semibold block mb-1">非标票据提醒</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {report.nonStandardDetails.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-end justify-between">
               <div className="text-sm text-gray-500">报销总金额</div>
               <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    <span className="text-sm text-gray-500 mr-0.5">¥</span>
                    {report.grandTotalAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">总税额 ¥{report.grandTotalTax.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
