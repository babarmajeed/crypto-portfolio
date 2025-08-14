import React from 'react';

export const QuickActions: React.FC = () => {
  const actions = [
    {
      label: 'Buy',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: 'bg-green-600 hover:bg-green-700',
      onClick: () => {
        // TODO: Implement buy functionality
        console.log('Buy action clicked');
      }
    },
    {
      label: 'Sell',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      color: 'bg-red-600 hover:bg-red-700',
      onClick: () => {
        // TODO: Implement sell functionality
        console.log('Sell action clicked');
      }
    },
    {
      label: 'Transfer',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      color: 'bg-blue-600 hover:bg-blue-700',
      onClick: () => {
        // TODO: Implement transfer functionality
        console.log('Transfer action clicked');
      }
    },
    {
      label: 'Import',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      ),
      color: 'bg-purple-600 hover:bg-purple-700',
      onClick: () => {
        // TODO: Implement import functionality
        console.log('Import action clicked');
      }
    }
  ];

  return (
    <div className="quick-actions">
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 ${action.color}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
      
      {/* Secondary Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button 
          className="flex items-center gap-1 px-3 py-1.5 text-gray-600 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          onClick={() => {
            // TODO: Implement sync functionality
            console.log('Sync portfolios clicked');
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync
        </button>
        
        <button 
          className="flex items-center gap-1 px-3 py-1.5 text-gray-600 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          onClick={() => {
            // TODO: Implement export functionality
            console.log('Export data clicked');
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
        
        <button 
          className="flex items-center gap-1 px-3 py-1.5 text-gray-600 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          onClick={() => {
            // TODO: Implement settings functionality
            console.log('Settings clicked');
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
};