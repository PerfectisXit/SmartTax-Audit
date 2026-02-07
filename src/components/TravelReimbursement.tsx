
import React, { useState } from 'react';
import { SmartFile } from '../types';
import { OcrProvider } from './SettingsModal';
import { OrganizerMode } from './OrganizerMode';
import { CalculatorMode } from './CalculatorMode';

interface TravelReimbursementProps {
  provider: OcrProvider;
  apiKey: string;
  modelName: string;
}

export const TravelReimbursement: React.FC<TravelReimbursementProps> = ({ provider, apiKey, modelName }) => {
  const [mode, setMode] = useState<'calculator' | 'organizer'>('organizer');
  const [applicationContext, setApplicationContext] = useState<{start?: string, end?: string}>({});
  const [transferSmartFiles, setTransferSmartFiles] = useState<SmartFile[]>([]);

  // Callback when Organizer extracts dates from an Application Form
  const handleContextFound = (start: string, end: string) => {
    setApplicationContext({ start, end });
  };

  // Callback when user clicks "Import to Calculator" in Organizer
  // Now transfers the full SmartFile object which contains extracted extraction data
  const handleTransfer = (files: SmartFile[]) => {
    setTransferSmartFiles(files);
    setMode('calculator');
  };

  return (
    <div className="space-y-8">
        {/* Stepper Navigation */}
        <div className="max-w-3xl mx-auto mb-8">
            <div className="relative flex items-center justify-center">
                {/* Connecting Line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -z-10 rounded"></div>
                
                {/* Step 1 */}
                <button 
                    onClick={() => setMode('organizer')}
                    className={`relative z-10 flex flex-col items-center group focus:outline-none`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-4 transition-all duration-300 ${mode === 'organizer' ? 'bg-blue-600 border-blue-100 text-white shadow-lg scale-110' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'}`}>
                        1
                    </div>
                    <span className={`mt-2 text-xs font-semibold uppercase tracking-wider transition-colors ${mode === 'organizer' ? 'text-blue-600' : 'text-gray-400'}`}>
                        智能归档
                    </span>
                </button>

                {/* Spacer */}
                <div className="w-24 md:w-48"></div>

                {/* Step 2 */}
                <button 
                    onClick={() => setMode('calculator')}
                    className={`relative z-10 flex flex-col items-center group focus:outline-none`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-4 transition-all duration-300 ${mode === 'calculator' ? 'bg-blue-600 border-blue-100 text-white shadow-lg scale-110' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'}`}>
                        2
                    </div>
                    <span className={`mt-2 text-xs font-semibold uppercase tracking-wider transition-colors ${mode === 'calculator' ? 'text-blue-600' : 'text-gray-400'}`}>
                        报销计算
                    </span>
                </button>
            </div>
        </div>

        {/* Keep both views mounted to preserve state */}
        <div className="transition-all duration-500 ease-in-out">
            <div className={mode === 'organizer' ? 'block' : 'hidden'}>
                <OrganizerMode 
                    provider={provider}
                    apiKey={apiKey}
                    modelName={modelName}
                    onApplicationContextFound={handleContextFound}
                    onTransferFiles={handleTransfer}
                />
            </div>
            <div className={mode === 'calculator' ? 'block' : 'hidden'}>
                <CalculatorMode 
                    provider={provider}
                    apiKey={apiKey}
                    modelName={modelName}
                    initialSmartFiles={transferSmartFiles}
                    applicationContext={applicationContext}
                />
            </div>
        </div>
    </div>
  );
};
