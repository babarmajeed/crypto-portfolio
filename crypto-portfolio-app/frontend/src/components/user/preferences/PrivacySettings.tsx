import React from 'react';
import { Shield, Eye, BarChart3, Users, Download, Trash2 } from 'lucide-react';
import { usePreferences } from '../../../hooks/usePreferences';
import { userService } from '../../../services/user.service';
import { UserPreferences } from '../../../types/user';
import { toast } from 'react-hot-toast';

export const PrivacySettings: React.FC = () => {
  const { 
    preferences, 
    updatePrivacySettings,
    isUpdatingPrivacy
  } = usePreferences();

  const privacySettings = preferences?.privacySettings || {
    portfolioPublic: false,
    showEmail: false,
    allowAnalytics: true,
    shareDataWithPartners: false,
  };

  const handlePrivacyChange = (key: keyof UserPreferences['privacySettings'], value: boolean) => {
    const updatedSettings = { ...privacySettings, [key]: value };
    updatePrivacySettings(updatedSettings);
  };

  const handleDownloadGDPRData = async () => {
    try {
      const blob = await userService.downloadGDPRData();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gdpr-data-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('GDPR data download started');
    } catch (error) {
      toast.error('Failed to download GDPR data');
    }
  };

  const privacyOptions = [
    {
      key: 'portfolioPublic' as const,
      title: 'Public Portfolio',
      description: 'Make your portfolio visible to other users',
      icon: Eye,
      warning: 'Your portfolio performance and holdings will be visible to other users',
    },
    {
      key: 'showEmail' as const,
      title: 'Show Email Address',
      description: 'Display your email address on your public profile',
      icon: Users,
      warning: 'Your email address will be visible to other users',
    },
    {
      key: 'allowAnalytics' as const,
      title: 'Usage Analytics',
      description: 'Help us improve the platform by sharing anonymized usage data',
      icon: BarChart3,
      warning: null,
    },
    {
      key: 'shareDataWithPartners' as const,
      title: 'Share Data with Partners',
      description: 'Allow sharing of anonymized data with trusted partners for research',
      icon: Shield,
      warning: 'Only anonymized, aggregated data will be shared',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Privacy Controls */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Privacy Controls
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Manage how your data is used and shared.
        </p>

        <div className="space-y-4">
          {privacyOptions.map((option) => {
            const Icon = option.icon;
            const isEnabled = privacySettings[option.key];
            
            return (
              <div
                key={option.key}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <Icon className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {option.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {option.description}
                      </p>
                      {option.warning && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 font-medium">
                          ⚠️ {option.warning}
                        </p>
                      )}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => handlePrivacyChange(option.key, e.target.checked)}
                      disabled={isUpdatingPrivacy}
                      className="sr-only peer"
                    />
                    <div className={`
                      w-11 h-6 rounded-full peer transition-colors
                      peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800
                      peer-checked:after:translate-x-full peer-checked:after:border-white
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600
                      ${isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                    `} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Rights */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Your Data Rights
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Exercise your rights over your personal data in compliance with GDPR and other privacy regulations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Download Data */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Download Your Data
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Get a copy of all your personal data we have on file
                </p>
                <button
                  onClick={handleDownloadGDPRData}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download GDPR Data
                </button>
              </div>
            </div>
          </div>

          {/* Delete Account */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 dark:text-red-100">
                  Delete Your Account
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Permanently delete your account and all associated data
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  This action cannot be undone
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Information */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          How We Protect Your Privacy
        </h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
            <p>All data is encrypted in transit and at rest using industry-standard encryption</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
            <p>We never sell your personal data to third parties</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
            <p>You can opt out of data sharing with partners at any time</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
            <p>We comply with GDPR, CCPA, and other privacy regulations</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
            <p>Regular security audits ensure your data remains protected</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            For more information, please read our{' '}
            <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
              Terms of Service
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
};