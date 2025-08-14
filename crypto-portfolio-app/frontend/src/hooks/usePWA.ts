import { useState, useEffect, useCallback } from 'react';

interface PWAInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  needsUpdate: boolean;
  isUpdating: boolean;
}

interface PWAActions {
  promptInstall: () => Promise<boolean>;
  checkForUpdates: () => Promise<void>;
  skipWaiting: () => void;
  dismissUpdate: () => void;
}

interface UsePWAReturn extends PWAState, PWAActions {}

export const usePWA = (): UsePWAReturn => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<PWAInstallPrompt | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is installed (running in standalone mode)
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkInstalled();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkInstalled();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const prompt = e as PWAInstallPrompt;
      setDeferredPrompt(prompt);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker and listen for updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          setRegistration(reg);

          // Check for updates
          const handleUpdateFound = () => {
            const newWorker = reg.installing;
            if (newWorker) {
              const handleStateChange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setNeedsUpdate(true);
                }
              };
              
              newWorker.addEventListener('statechange', handleStateChange);
            }
          };

          reg.addEventListener('updatefound', handleUpdateFound);

          // Check for existing updates
          if (reg.waiting) {
            setNeedsUpdate(true);
          }

          // Check for updates periodically
          const checkForUpdates = () => {
            reg.update();
          };

          const updateInterval = setInterval(checkForUpdates, 60000); // Check every minute

          return () => {
            clearInterval(updateInterval);
            reg.removeEventListener('updatefound', handleUpdateFound);
          };
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Listen for service worker controller changes
      const handleControllerChange = () => {
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  // Prompt install function
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Check for updates function
  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (registration) {
      try {
        await registration.update();
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }, [registration]);

  // Skip waiting and apply update
  const skipWaiting = useCallback(() => {
    if (registration?.waiting) {
      setIsUpdating(true);
      
      // Send skip waiting message to service worker
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // The controllerchange event will reload the page
      const handleControllerChange = () => {
        setIsUpdating(false);
        setNeedsUpdate(false);
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
    }
  }, [registration]);

  // Dismiss update notification
  const dismissUpdate = useCallback(() => {
    setNeedsUpdate(false);
  }, []);

  return {
    // State
    isInstallable,
    isInstalled,
    isOffline,
    needsUpdate,
    isUpdating,
    
    // Actions
    promptInstall,
    checkForUpdates,
    skipWaiting,
    dismissUpdate
  };
};

export default usePWA;