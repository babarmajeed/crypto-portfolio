import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

interface PWAOfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showWhenOnline?: boolean;
  autoHide?: boolean;
  className?: string;
}

const PWAOfflineIndicator: React.FC<PWAOfflineIndicatorProps> = ({
  position = 'top',
  showWhenOnline = true,
  autoHide = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(null);
  const { isOffline } = usePWA();

  // Handle visibility based on connection status
  useEffect(() => {
    if (isOffline) {
      setIsVisible(true);
    } else {
      // When coming back online
      if (lastOnlineTime === null) {
        setLastOnlineTime(Date.now());
      }
      
      if (showWhenOnline) {
        setIsVisible(true);
        
        if (autoHide) {
          const timer = setTimeout(() => {
            setIsVisible(false);
          }, 3000);
          
          return () => clearTimeout(timer);
        }
      } else {
        setIsVisible(false);
      }
    }
  }, [isOffline, showWhenOnline, autoHide, lastOnlineTime]);

  // Reset last online time when going offline
  useEffect(() => {
    if (isOffline) {
      setLastOnlineTime(null);
    }
  }, [isOffline]);

  if (!isVisible) {
    return null;
  }

  const getStatusInfo = () => {
    if (isOffline) {
      return {
        icon: <WifiOff size={16} className="text-orange-600" />,
        text: 'You\'re offline',
        subtext: 'Some features may be limited',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800'
      };
    } else {
      return {
        icon: <CheckCircle size={16} className="text-green-600" />,
        text: 'Back online',
        subtext: 'All features are available',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800'
      };
    }
  };

  const statusInfo = getStatusInfo();
  const positionClasses = position === 'top' 
    ? 'top-4 left-1/2 transform -translate-x-1/2'
    : 'bottom-4 left-1/2 transform -translate-x-1/2';

  return (
    <div className={`fixed z-50 ${positionClasses} ${className}`}>
      <div className={`
        ${statusInfo.bgColor} 
        ${statusInfo.borderColor} 
        ${statusInfo.textColor}
        border rounded-lg shadow-lg p-3 max-w-sm
        transition-all duration-300
      `}>
        <div className="flex items-center space-x-2">
          {statusInfo.icon}
          <div className="flex-1">
            <div className="text-sm font-medium">
              {statusInfo.text}
            </div>
            <div className="text-xs opacity-75">
              {statusInfo.subtext}
            </div>
          </div>
          
          {!isOffline && (
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 rounded-md hover:bg-green-100 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" className="text-green-600">
                <path
                  d="M6 0L6 12M0 6L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  transform="rotate(45 6 6)"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAOfflineIndicator;