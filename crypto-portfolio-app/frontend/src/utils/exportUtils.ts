import { format } from 'date-fns';

interface Transaction {
  id: string;
  timestamp: Date;
  type: string;
  asset: string;
  quantity: number;
  price: number;
  total: number;
  fee?: number;
  exchange: string;
  status: string;
  orderId?: string;
  notes?: string;
}

/**
 * Export transactions to CSV format
 */
export const exportToCSV = async (transactions: Transaction[], filename: string) => {
  const headers = [
    'Date',
    'Time',
    'Type',
    'Asset',
    'Quantity',
    'Price',
    'Total',
    'Fee',
    'Exchange',
    'Status',
    'Order ID',
    'Notes'
  ];

  const rows = transactions.map(tx => [
    format(new Date(tx.timestamp), 'yyyy-MM-dd'),
    format(new Date(tx.timestamp), 'HH:mm:ss'),
    tx.type,
    tx.asset,
    tx.quantity.toString(),
    tx.price.toFixed(2),
    tx.total.toFixed(2),
    tx.fee?.toFixed(2) || '0',
    tx.exchange,
    tx.status,
    tx.orderId || '',
    tx.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

/**
 * Export transactions to Excel format (simplified CSV with Excel-friendly formatting)
 */
export const exportToExcel = async (transactions: Transaction[], filename: string) => {
  // For a real Excel export, you would use a library like xlsx or exceljs
  // This is a simplified version that creates a CSV that Excel can open
  const headers = [
    'Date',
    'Type',
    'Asset',
    'Quantity',
    'Price',
    'Total',
    'Fee',
    'Exchange',
    'Status'
  ];

  const rows = transactions.map(tx => [
    format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm:ss'),
    tx.type.replace('_', ' ').toUpperCase(),
    tx.asset,
    tx.quantity,
    tx.price,
    tx.total,
    tx.fee || 0,
    tx.exchange,
    tx.status
  ]);

  const csvContent = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t'))
  ].join('\n');

  downloadFile(csvContent, `${filename}.xls`, 'application/vnd.ms-excel');
};

/**
 * Export transactions to PDF format
 */
export const exportToPDF = async (transactions: Transaction[], filename: string) => {
  // For a real PDF export, you would use a library like jsPDF or pdfmake
  // This is a simplified HTML version that can be printed to PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction History</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .header { margin-bottom: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Transaction History Report</h1>
        <p>Generated on: ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
        <p>Total Transactions: ${transactions.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Asset</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
            <th>Fee</th>
            <th>Exchange</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(tx => `
            <tr>
              <td>${format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm')}</td>
              <td>${tx.type.replace('_', ' ').toUpperCase()}</td>
              <td>${tx.asset}</td>
              <td>${tx.quantity.toFixed(8)}</td>
              <td>$${tx.price.toFixed(2)}</td>
              <td>$${tx.total.toFixed(2)}</td>
              <td>$${(tx.fee || 0).toFixed(2)}</td>
              <td>${tx.exchange}</td>
              <td>${tx.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>This report contains ${transactions.length} transactions.</p>
        <p>Report generated from Crypto Portfolio App</p>
      </div>
    </body>
    </html>
  `;

  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
};

/**
 * Helper function to download a file
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format currency for export
 */
export const formatCurrencyForExport = (value: number): string => {
  return value.toFixed(2);
};

/**
 * Format date for export
 */
export const formatDateForExport = (date: Date): string => {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
};