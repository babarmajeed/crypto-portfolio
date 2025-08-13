import React, { useState } from 'react';
import { Shield, Smartphone, Activity, Download } from 'lucide-react';
import { SecurityOverview } from '../../components/user/security/SecurityOverview';
import { TrustedDevices } from '../../components/user/security/TrustedDevices';
import { AuditLogViewer } from '../../components/user/security/AuditLogViewer';
import { DataExport } from '../../components/user/security/DataExport';

type TabId = 'overview' | 'devices' | 'activity' | 'export';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    label: 'Security Overview',
    icon: Shield,
    component: SecurityOverview,
  },
  {
    id: 'devices',
    label: 'Trusted Devices',
    icon: Smartphone,
    component: TrustedDevices,
  },
  {
    id: 'activity',
    label: 'Activity Log',
    icon: Activity,
    component: AuditLogViewer,
  },
  {
    id: 'export',
    label: 'Data Export',
    icon: Download,
    component: DataExport,
  },
];

export const SecurityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || SecurityOverview;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Security & Privacy
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account security, monitor activity, and control your data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="flex space-x-8" aria-label="Security tabs">
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
      <div className="min-h-[600px]">
        <ActiveComponent />
      </div>
    </div>
  );
};