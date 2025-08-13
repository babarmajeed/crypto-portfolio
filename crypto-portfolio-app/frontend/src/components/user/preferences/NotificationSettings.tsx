import React, { useState } from 'react';
import { Bell, Mail, Smartphone, MessageSquare, TestTube, Volume2 } from 'lucide-react';
import { usePreferences } from '../../../hooks/usePreferences';
import { UserPreferences } from '../../../types/user';

interface NotificationGroup {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  settings: {
    key: keyof UserPreferences['notifications'];
    label: string;
    description: string;
  }[];
}

const notificationGroups: NotificationGroup[] = [
  {
    title: 'Account Security',
    description: 'Important security and account-related notifications',
    icon: Bell,
    settings: [
      {
        key: 'security',
        label: 'Security Alerts',
        description: 'Login attempts, password changes, and security events',
      },
    ],
  },
  {
    title: 'Portfolio & Trading',
    description: 'Updates about your investments and trading activity',
    icon: Volume2,
    settings: [
      {
        key: 'portfolio',
        label: 'Portfolio Updates',
        description: 'Significant changes in your portfolio value',
      },
      {
        key: 'priceAlerts',
        label: 'Price Alerts',
        description: 'When your watched assets hit target prices',
      },
    ],
  },
  {
    title: 'News & Updates',
    description: 'Market news and platform updates',
    icon: MessageSquare,
    settings: [
      {
        key: 'newsUpdates',
        label: 'News Updates',
        description: 'Important market news and crypto updates',
      },
    ],
  },
  {
    title: 'Marketing',
    description: 'Promotional content and product announcements',
    icon: Mail,
    settings: [
      {
        key: 'marketing',
        label: 'Marketing Communications',
        description: 'Product updates, feature announcements, and promotions',
      },
    ],
  },
];

const deliveryChannels = [
  {
    key: 'email' as const,
    label: 'Email',
    icon: Mail,
    description: 'Receive notifications via email',
  },
  {
    key: 'push' as const,
    label: 'Push Notifications',
    icon: Bell,
    description: 'Browser and mobile push notifications',
  },
  {
    key: 'sms' as const,
    label: 'SMS',
    icon: Smartphone,
    description: 'Text message notifications',
  },
];

export const NotificationSettings: React.FC = () => {
  const { 
    preferences, 
    updateNotifications, 
    testNotification,
    isUpdatingNotifications,
    isTesting
  } = usePreferences();

  const [testingChannel, setTestingChannel] = useState<keyof UserPreferences['notifications'] | null>(null);

  const notifications = preferences?.notifications || {
    email: true,
    push: true,
    sms: false,
    marketing: false,
    security: true,
    portfolio: true,
    priceAlerts: true,
    newsUpdates: true,
  };

  const handleNotificationChange = (key: keyof UserPreferences['notifications'], value: boolean) => {
    const updatedNotifications = { ...notifications, [key]: value };
    updateNotifications(updatedNotifications);
  };

  const handleTestNotification = async (type: keyof UserPreferences['notifications']) => {
    setTestingChannel(type);
    try {
      await testNotification(type);
    } finally {
      setTestingChannel(null);
    }
  };

  const handleMasterToggle = (channel: 'email' | 'push' | 'sms', enabled: boolean) => {
    // When disabling a channel, we need to be careful not to disable security notifications
    // for critical channels like email
    if (!enabled && channel === 'email') {
      if (!window.confirm('Disabling email notifications will prevent you from receiving important security alerts. Are you sure?')) {
        return;
      }
    }
    
    handleNotificationChange(channel, enabled);
  };

  return (
    <div className="space-y-8">
      {/* Delivery Channels */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Delivery Channels
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose how you want to receive notifications.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {deliveryChannels.map((channel) => {
            const Icon = channel.icon;
            const isEnabled = notifications[channel.key];
            
            return (
              <div
                key={channel.key}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${isEnabled
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${isEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    <div>
                      <h4 className={`font-medium ${isEnabled ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                        {channel.label}
                      </h4>
                      <p className={`text-sm mt-1 ${isEnabled ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {channel.description}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => handleMasterToggle(channel.key, e.target.checked)}
                      disabled={isUpdatingNotifications}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Test Button */}
                {isEnabled && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => handleTestNotification(channel.key)}
                      disabled={isTesting || testingChannel === channel.key}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <TestTube className="h-3 w-3" />
                      {testingChannel === channel.key ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notification Categories */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Notification Categories
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose which types of notifications you want to receive.
        </p>

        <div className="space-y-6">
          {notificationGroups.map((group) => {
            const GroupIcon = group.icon;
            
            return (
              <div key={group.title} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <GroupIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {group.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 ml-8">
                  {group.settings.map((setting) => {
                    const isEnabled = notifications[setting.key];
                    
                    return (
                      <div key={setting.key} className="flex items-start justify-between">
                        <div className="flex-1">
                          <label 
                            htmlFor={setting.key}
                            className="block font-medium text-gray-900 dark:text-white cursor-pointer"
                          >
                            {setting.label}
                          </label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {setting.description}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            id={setting.key}
                            checked={isEnabled}
                            onChange={(e) => handleNotificationChange(setting.key, e.target.checked)}
                            disabled={isUpdatingNotifications}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200">
              Important Security Notice
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Security notifications cannot be disabled completely to protect your account. You will always receive critical security alerts via email, regardless of your notification preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};