import React, { useState } from 'react';
import { RefreshCw, X, Download, AlertCircle } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

interface PWAUpdatePromptProps {
  onUpdate?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const PWAUpdatePrompt: React.FC<PWAUpdatePromptProps> = ({
  onUpdate,
  onDismiss,
  className = ''
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { needsUpdate, skipWaiting, dismissUpdate } = usePWA();

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      skipWaiting();
      onUpdate?.();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    dismissUpdate();
    onDismiss?.();
  };

  if (!needsUpdate) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <RefreshCw size={16} className="text-blue-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">
              App Update Available
            </h4>
            <p className="text-xs text-gray-600 mb-3">
              A new version of the app is ready to install. Update now for the latest features and improvements.
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 transition-colors"
              >
                Later
              </button>
              
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors flex items-center space-x-1"
              >
                {isUpdating ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    <span>Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Dismiss update prompt"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;