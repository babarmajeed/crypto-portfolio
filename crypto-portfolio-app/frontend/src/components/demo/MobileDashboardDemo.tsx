import React, { useState, useEffect } from 'react';
import { DashboardOverview } from '../dashboard/DashboardOverview';
import { MobileNavigation, FloatingActionButton, BottomSheet } from '../ui/MobileNavigation';
import { useMobileResponsive } from '../../hooks/useMobileResponsive';
import { initializeMobileOptimizations } from '../../utils/mobileOptimizations';

// Mock data for demo
const mockPortfolioData = {
  totalValue: 125420.67,
  totalValue24hAgo: 118650.32,
  totalValueChange24h: 6770.35,
  totalValueChangePercentage24h: 5.71,
  totalAssets: 12,
  connectedExchanges: 3,
  volume24h: 24650,
  lastUpdated: new Date().toISOString(),
  allocation: [
    { symbol: 'BTC', name: 'Bitcoin', value: 75252.40, percentage: 60 },
    { symbol: 'ETH', name: 'Ethereum', value: 25084.13, percentage: 20 },
    { symbol: 'ADA', name: 'Cardano', value: 12542.07, percentage: 10 },
    { symbol: 'DOT', name: 'Polkadot', value: 12542.07, percentage: 10 }
  ]
};

const mockPerformanceData = {
  daily: { change: 5.71, value: 6770.35 },
  weekly: { change: 12.34, value: 13456.78 },
  monthly: { change: -2.45, value: -3123.45 },
  yearly: { change: 145.67, value: 67890.12 }
};

const mockTransactions = [
  {
    id: '1',
    type: 'buy',
    symbol: 'BTC',
    amount: 0.5,
    value: 25000,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    type: 'sell',
    symbol: 'ETH',
    amount: 2.3,
    value: 8500,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  }
];

// Mock hook to provide data
const mockUseDashboardData = () => ({
  portfolioData: mockPortfolioData,
  performanceData: mockPerformanceData,
  recentTransactions: mockTransactions,
  isLoading: false,
  error: null,
  refresh: () => console.log('Refreshing data...')
});

// Replace the actual hook for demo
(window as any).mockUseDashboardData = mockUseDashboardData;

export const MobileDashboardDemo: React.FC = () => {
  const { isMobile, isTablet, screenSize } = useMobileResponsive();
  const [currentNavItem, setCurrentNavItem] = useState('dashboard');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [demoMode, setDemoMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  // Initialize mobile optimizations
  useEffect(() => {
    initializeMobileOptimizations();
  }, []);

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      active: currentNavItem === 'dashboard'
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
      active: currentNavItem === 'portfolio',
      badge: 12
    },
    {
      id: 'transactions',
      label: 'Activity',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      active: currentNavItem === 'transactions',
      badge: 3
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      active: currentNavItem === 'settings'
    }
  ];

  const handleNavigation = (item: any) => {
    setCurrentNavItem(item.id);
    console.log(`Navigating to: ${item.label}`);
  };

  const handleFABClick = () => {
    setShowBottomSheet(true);
  };

  const quickActions = [
    { label: 'Buy Crypto', icon: '💰' },
    { label: 'Sell Assets', icon: '💸' },
    { label: 'Transfer', icon: '🔄' },
    { label: 'Import Wallet', icon: '📥' },
    { label: 'Export Data', icon: '📤' },
    { label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Demo Controls */}
      <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-3 border">
        <div className="text-xs font-medium text-gray-700 mb-2">Demo Mode:</div>
        <div className="flex gap-1">
          {(['mobile', 'tablet', 'desktop'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDemoMode(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                demoMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Current: {screenSize} ({window.innerWidth}x{window.innerHeight})
        </div>
      </div>

      {/* Device Frame Simulator */}
      <div className={`
        mx-auto transition-all duration-300 ease-in-out
        ${demoMode === 'mobile' ? 'max-w-sm' : ''}
        ${demoMode === 'tablet' ? 'max-w-4xl' : ''}
        ${demoMode === 'desktop' ? 'max-w-7xl' : ''}
      `}>
        
        {/* Dashboard Content */}
        <div className={`${isMobile ? 'pb-20' : ''}`}>
          <DashboardOverview />
        </div>

        {/* Mobile Navigation */}
        {isMobile && (
          <MobileNavigation
            items={navigationItems}
            onItemClick={handleNavigation}
            showLabels={true}
          />
        )}

        {/* Floating Action Button (Mobile Only) */}
        {isMobile && currentNavItem === 'dashboard' && (
          <FloatingActionButton
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
            onClick={handleFABClick}
            position={{ bottom: '80px', right: '20px' }}
            color="primary"
          />
        )}

        {/* Bottom Sheet */}
        <BottomSheet
          isOpen={showBottomSheet}
          onClose={() => setShowBottomSheet(false)}
          title="Quick Actions"
          height="auto"
        >
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => {
                  console.log(`${action.label} clicked`);
                  setShowBottomSheet(false);
                }}
              >
                <span className="text-2xl mb-2">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>

      {/* Performance Info */}
      <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs text-gray-600 max-w-xs">
        <div className="font-medium mb-1">Performance Info:</div>
        <div>Touch Support: {('ontouchstart' in window) ? '✅' : '❌'}</div>
        <div>Viewport: {window.innerWidth}×{window.innerHeight}</div>
        <div>Device Pixel Ratio: {window.devicePixelRatio}</div>
        <div>Memory: {(navigator as any).deviceMemory || 'Unknown'} GB</div>
        <div>CPU Cores: {navigator.hardwareConcurrency || 'Unknown'}</div>
      </div>
    </div>
  );
};

export default MobileDashboardDemo;