import React from 'react';
import { Shield, CheckCircle, AlertTriangle, Clock, Smartphone, Key, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../../../services/user.service';
import { useProfile } from '../../../hooks/useProfile';
import { format } from 'date-fns';

export const SecurityOverview: React.FC = () => {
  const { profile } = useProfile();

  // Fetch security settings
  const { data: securitySettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['security-settings'],
    queryFn: userService.getSecuritySettings,
  });

  // Fetch trusted devices
  const { data: trustedDevices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ['trusted-devices'],
    queryFn: userService.getTrustedDevices,
  });

  // Fetch recent audit logs
  const { data: auditData } = useQuery({
    queryKey: ['audit-logs-recent'],
    queryFn: () => userService.getAuditLogs({
      limit: 5,
      actions: ['login', 'password_change', '2fa_enable', '2fa_disable'],
    }),
  });

  const recentActivity = auditData?.logs || [];

  // Calculate security score
  const calculateSecurityScore = (): number => {
    let score = 0;
    if ((profile as any)?.isEmailVerified) score += 20;
    if ((profile as any)?.is2FAEnabled) score += 30;
    if (securitySettings?.passwordLastChanged) {
      const daysSincePasswordChange = Math.floor(
        (Date.now() - new Date(securitySettings.passwordLastChanged).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSincePasswordChange < 90) score += 25;
      else if (daysSincePasswordChange < 180) score += 15;
      else score += 5;
    }
    if (trustedDevices.length <= 3) score += 15; // Not too many trusted devices
    if (securitySettings?.loginNotifications) score += 10;
    return Math.min(score, 100);
  };

  const securityScore = calculateSecurityScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (score >= 60) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const securityItems = [
    {
      title: 'Email Verification',
      status: (profile as any)?.isEmailVerified,
      description: (profile as any)?.isEmailVerified ? 'Your email is verified' : 'Verify your email address',
      icon: CheckCircle,
    },
    {
      title: 'Two-Factor Authentication',
      status: (profile as any)?.is2FAEnabled,
      description: (profile as any)?.is2FAEnabled ? '2FA is enabled' : 'Enable 2FA for better security',
      icon: Key,
    },
    {
      title: 'Recent Password Change',
      status: securitySettings?.passwordLastChanged && 
        (Date.now() - new Date(securitySettings.passwordLastChanged).getTime()) < 90 * 24 * 60 * 60 * 1000,
      description: securitySettings?.passwordLastChanged
        ? `Changed ${format(new Date(securitySettings.passwordLastChanged), 'MMM dd, yyyy')}`
        : 'Change your password regularly',
      icon: Shield,
    },
    {
      title: 'Login Notifications',
      status: securitySettings?.loginNotifications,
      description: securitySettings?.loginNotifications 
        ? 'Login notifications are enabled' 
        : 'Enable login notifications',
      icon: Activity,
    },
  ];

  if (isLoadingSettings || isLoadingDevices) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Score */}
      <div className={`rounded-lg border p-6 ${getScoreBgColor(securityScore)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className={`h-8 w-8 ${getScoreColor(securityScore)}`} />
            <div>
              <h3 className={`text-xl font-bold ${getScoreColor(securityScore)}`}>
                Security Score: {securityScore}/100
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {securityScore >= 80 ? 'Excellent security' : 
                 securityScore >= 60 ? 'Good security' : 'Needs improvement'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              securityScore >= 80 ? 'bg-green-500' :
              securityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${securityScore}%` }}
          />
        </div>

        {securityScore < 80 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            Improve your security by enabling two-factor authentication and updating your password regularly.
          </p>
        )}
      </div>

      {/* Security Status Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityItems.map((item) => {
          const Icon = item.icon;
          const isGood = item.status;
          
          return (
            <div
              key={item.title}
              className={`
                p-4 rounded-lg border
                ${isGood 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${
                  isGood ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                }`} />
                <div>
                  <h4 className={`font-medium ${
                    isGood ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'
                  }`}>
                    {item.title}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    isGood ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {item.description}
                  </p>
                </div>
                {isGood ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Trusted Devices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {trustedDevices.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {profile?.lastLogin 
                  ? format(new Date(profile.lastLogin), 'MMM dd')
                  : 'Never'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recent Activity</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {recentActivity.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Security Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-500" />
            Recent Security Activity
          </h4>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`
                  w-2 h-2 rounded-full mt-2
                  ${activity.success ? 'bg-green-500' : 'bg-red-500'}
                `} />
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                    {activity.ipAddress && ` • ${activity.ipAddress}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};