import React from 'react';
import { ProcessedResult, ExpenseCategory } from '../types';

interface ResultCardProps {
  result: ProcessedResult;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const { data, audit, category } = result;

  // Calculate pre-tax amount safely
  const preTaxAmount = Math.max(0, data.totalAmount - data.taxAmount);

  const getStatusColor = (status: 'valid' | 'warning' | 'invalid') => {
    if (status === 'valid') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' };
    if (status === 'warning') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: 'text-rose-500' };
  };

  const statusStyles = getStatusColor(audit.generalStatus);

  return (
    <div className="space-y-6">
      
      {/* 1. Audit Conclusion Banner */}
      <div className={`rounded-2xl border ${statusStyles.border} ${statusStyles.bg} p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-full bg-white shadow-sm border ${statusStyles.border}`}>
             {audit.generalStatus === 'valid' && <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
             {audit.generalStatus === 'warning' && <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
             {audit.generalStatus === 'invalid' && <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
          </div>
          <div>
             <h3 className={`text-lg font-bold ${statusStyles.text}`}>
               {audit.generalStatus === 'valid' ? '审核通过' : audit.generalStatus === 'warning' ? '需人工复核' : '审核不通过'}
             </h3>
             <div className="flex items-center gap-2 mt-1 text-sm opacity-80 text-gray-700">
                <span className="font-medium">{data.invoiceType}</span>
                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                <span className="font-medium">{category}</span>
             </div>
          </div>
        </div>
        
      </div>

      {/* 2. Extraction Details Card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
           <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
             <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             发票识别详情
           </h4>
           <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm">AI EXTRACTED</span>
        </div>
        
        <div className="p-6">
          {/* Key Amounts - Prominent Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
             <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-start relative overflow-hidden group">
               <span className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">价税合计</span>
               <div className="text-2xl font-bold text-gray-900 tracking-tight">
                 <span className="text-sm align-top mr-0.5 text-gray-500">¥</span>
                 {data.totalAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
               </div>
               <svg className="absolute -right-2 -bottom-4 w-16 h-16 text-blue-200 opacity-20 group-hover:scale-110 transition" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
             </div>

             <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-start">
               <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">不含税金额</span>
               <div className="text-xl font-bold text-gray-700">
                 <span className="text-xs align-top mr-0.5 text-gray-400">¥</span>
                 {preTaxAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
               </div>
             </div>

             <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-start">
               <div className="flex justify-between w-full">
                  <span className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">税额</span>
                  <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 rounded border border-gray-200">
                    税率: {data.taxRate || '?'}
                  </span>
               </div>
               <div className="text-xl font-bold text-gray-700">
                 <span className="text-xs align-top mr-0.5 text-gray-400">¥</span>
                 {data.taxAmount.toLocaleString('zh-CN', {minimumFractionDigits: 2})}
               </div>
             </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <div className="group">
              <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                购买方名称
              </label>
              <div className="text-sm font-medium text-gray-900 break-words border-b border-gray-100 pb-1 group-hover:border-blue-200 transition-colors">
                {data.buyerName}
              </div>
            </div>

            <div className="group">
              <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                纳税人识别号
              </label>
              <div className="text-sm font-mono font-medium text-gray-900 border-b border-gray-100 pb-1 group-hover:border-blue-200 transition-colors">
                {data.buyerTaxId}
              </div>
            </div>

            <div className="group">
              <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                开票日期
              </label>
              <div className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-1 group-hover:border-blue-200 transition-colors">
                {data.invoiceDate}
              </div>
            </div>

            <div className="group">
              <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                内容摘要
              </label>
              <div className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-1 group-hover:border-blue-200 transition-colors truncate">
                {data.items.length > 0 ? data.items.join(', ') : <span className="text-gray-400 italic">未识别到明细</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Compliance Rules */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/30">
           <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">合规性检查规则</h4>
        </div>
        <div className="p-6 pt-4">
          <ul className="space-y-4">
            <li className="flex items-start">
              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 border ${
                audit.companyMatch.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                audit.companyMatch.severity === 'error' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}>
                 {audit.companyMatch.passed ? 
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : 
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 }
              </div>
              <span className={`text-sm ${audit.companyMatch.passed ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                {audit.companyMatch.message}
              </span>
            </li>
            
            {category === ExpenseCategory.ACCOMMODATION && (
               <li className="flex items-start">
               <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 border ${
                 audit.invoiceTypeCheck.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'
               }`}>
                  {audit.invoiceTypeCheck.passed ? 
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : 
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  }
               </div>
               <span className={`text-sm ${audit.invoiceTypeCheck.passed ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                 {audit.invoiceTypeCheck.message}
               </span>
             </li>
            )}
          </ul>
        </div>
      </div>

    </div>
  );
};
