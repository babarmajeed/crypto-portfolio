import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';

interface ExportMenuProps {
  selectedTransactions: string[];
  allTransactions: any[];
}

const ExportMenu: React.FC<ExportMenuProps> = ({ selectedTransactions, allTransactions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const transactionsToExport = selectedTransactions.length > 0
    ? allTransactions.filter(t => selectedTransactions.includes(t.id))
    : allTransactions;

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      const filename = `transactions_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`;
      
      switch (format) {
        case 'csv':
          await exportToCSV(transactionsToExport, filename);
          break;
        case 'excel':
          await exportToExcel(transactionsToExport, filename);
          break;
        case 'pdf':
          await exportToPDF(transactionsToExport, filename);
          break;
      }

      setExportSuccess(format.toUpperCase());
      setTimeout(() => {
        setExportSuccess(null);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
        {selectedTransactions.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-blue-700 rounded-full">
            {selectedTransactions.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">Export Transactions</p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedTransactions.length > 0
                  ? `${selectedTransactions.length} selected`
                  : `All ${allTransactions.length} transactions`}
              </p>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-left">Export as CSV</span>
                {exportSuccess === 'CSV' && <Check className="w-4 h-4 text-green-500" />}
              </button>
              
              <button
                onClick={() => handleExport('excel')}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-left">Export as Excel</span>
                {exportSuccess === 'EXCEL' && <Check className="w-4 h-4 text-green-500" />}
              </button>
              
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-left">Export as PDF</span>
                {exportSuccess === 'PDF' && <Check className="w-4 h-4 text-green-500" />}
              </button>
            </div>

            {isExporting && (
              <div className="p-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-sm text-gray-600">Exporting...</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExportMenu;