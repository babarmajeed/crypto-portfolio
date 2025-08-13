import React, { useState } from 'react';
import { Settings, Palette, Bell, Shield, DollarSign, RotateCcw } from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import { CurrencySettings } from './CurrencySettings';
import { NotificationSettings } from './NotificationSettings';
import { PrivacySettings } from './PrivacySettings';
import { usePreferences } from '../../../hooks/usePreferences';

interface PreferencesPanelProps {
  className?: string;
}

type TabId = 'theme' | 'currency' | 'notifications' | 'privacy';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: 'theme',
    label: 'Theme & Display',
    icon: Palette,
    component: ThemeSettings,
  },
  {
    id: 'currency',
    label: 'Currency & Format',
    icon: DollarSign,
    component: CurrencySettings,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    component: NotificationSettings,
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: Shield,
    component: PrivacySettings,
  },
];

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const { resetPreferences, isResetting } = usePreferences();

  const handleResetPreferences = () => {
    if (window.confirm('Are you sure you want to reset all preferences to default values? This action cannot be undone.')) {
      resetPreferences();
    }
  };

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ThemeSettings;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preferences
            </h2>
          </div>
          <button
            onClick={handleResetPreferences}
            disabled={isResetting}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
            title="Reset all preferences to defaults"
          >
            <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Resetting...' : 'Reset All'}
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Customize your experience with personalized settings.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6" aria-label="Preferences tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <ActiveComponent />
      </div>
    </div>
  );
};