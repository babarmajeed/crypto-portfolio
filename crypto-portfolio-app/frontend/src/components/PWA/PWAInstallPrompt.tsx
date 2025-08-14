import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Zap, Shield, Wifi, WifiOff } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { useResponsive } from '../../hooks/useResponsive';

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  autoShow?: boolean;
  className?: string;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss,
  autoShow = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const { isMobile, isTablet } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

  // Check if user has dismissed the prompt before
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show again after 7 days
      if (daysSinceDismissal < 7) {
        setIsDismissed(true);
      }
    }
  }, []);

  // Auto show logic
  useEffect(() => {
    if (autoShow && isInstallable && !isInstalled && !isDismissed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000); // Show after 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [autoShow, isInstallable, isInstalled, isDismissed]);

  const handleInstall = async () => {
    try {
      setIsInstalling(true);
      const success = await promptInstall();
      
      if (success) {
        setIsVisible(false);
        onInstall?.();
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    onDismiss?.();
  };

  if (!isVisible || !isInstallable || isInstalled) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
        {/* Install prompt */}
        <div className={`bg-white rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 ${className}`}>
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Download size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Install App
                  </h3>
                  <p className="text-sm text-gray-600">
                    Get the full experience
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Dismiss install prompt"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="px-6 pb-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                {isTouchDevice ? (
                  <Smartphone size={16} className="text-blue-600 flex-shrink-0" />
                ) : (
                  <Monitor size={16} className="text-blue-600 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-700">
                  {isTouchDevice ? 'Add to home screen' : 'Install on desktop'}
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <Zap size={16} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  Faster loading and performance
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <WifiOff size={16} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  Works offline with cached data
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <Shield size={16} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  Secure and always up-to-date
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-2 border-t border-gray-100">
            <div className="flex space-x-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Not now
              </button>
              
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isInstalling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Install</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PWAInstallPrompt;