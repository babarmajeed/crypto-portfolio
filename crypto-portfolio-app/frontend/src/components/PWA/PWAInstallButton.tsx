import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Check } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { useResponsive } from '../../hooks/useResponsive';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  fullWidth?: boolean;
  onInstall?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  fullWidth = false,
  onInstall,
  className = '',
  children
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const { isMobile, isTablet } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

  const handleInstall = async () => {
    try {
      setIsInstalling(true);
      const success = await promptInstall();
      
      if (success) {
        onInstall?.();
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Don't render if not installable or already installed
  if (!isInstallable || isInstalled) {
    return null;
  }

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white border-transparent';
      case 'secondary':
        return 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300';
      case 'ghost':
        return 'bg-transparent hover:bg-gray-50 text-gray-700 border-transparent';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white border-transparent';
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  // Get icon size based on button size
  const getIconSize = () => {
    switch (size) {
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 20;
      default: return 16;
    }
  };

  const getIcon = () => {
    if (isInstalling) {
      return (
        <div className="border-2 border-current border-t-transparent rounded-full animate-spin"
             style={{ width: getIconSize(), height: getIconSize() }} />
      );
    }
    
    if (isTouchDevice) {
      return <Smartphone size={getIconSize()} />;
    }
    
    return <Download size={getIconSize()} />;
  };

  const getText = () => {
    if (children) {
      return children;
    }
    
    if (isInstalling) {
      return 'Installing...';
    }
    
    if (isTouchDevice) {
      return 'Add to Home Screen';
    }
    
    return 'Install App';
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className={`
        inline-flex items-center justify-center
        ${getVariantStyles()}
        ${getSizeStyles()}
        ${fullWidth ? 'w-full' : ''}
        border rounded-lg font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
      aria-label={isInstalling ? 'Installing app...' : 'Install app'}
    >
      <div className="flex items-center space-x-2">
        {showIcon && (
          <span className="flex-shrink-0">
            {getIcon()}
          </span>
        )}
        <span>{getText()}</span>
      </div>
    </button>
  );
};

export default PWAInstallButton;