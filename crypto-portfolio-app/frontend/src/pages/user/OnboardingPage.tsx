import React from 'react';
import { Navigate } from 'react-router-dom';
import { OnboardingWizard } from '../../components/user/onboarding/OnboardingWizard';
import { ProfileForm } from '../../components/user/profile/ProfileForm';
import { PreferencesPanel } from '../../components/user/preferences/PreferencesPanel';
import { SecurityOverview } from '../../components/user/security/SecurityOverview';
import { useAuth } from '../../contexts/AuthContext';
import { OnboardingStep } from '../../hooks/useOnboarding';

// Onboarding step components
const WelcomeStep: React.FC<{ data: any; onDataChange: (data: any) => void; onNext?: () => void }> = ({
  onNext
}) => {
  return (
    <div className="text-center py-8">
      <div className="max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Crypto Portfolio!
        </h3>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          We're excited to help you manage your cryptocurrency investments. Let's get your account set up with everything you need to track, analyze, and grow your portfolio.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
            <div className="text-blue-600 dark:text-blue-400 text-3xl mb-3">📊</div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Track Performance</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor your portfolio value, gains, and losses across multiple exchanges and wallets.
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
            <div className="text-green-600 dark:text-green-400 text-3xl mb-3">🔐</div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Stay Secure</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Advanced security features including 2FA, audit logs, and trusted device management.
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
            <div className="text-purple-600 dark:text-purple-400 text-3xl mb-3">📈</div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Make Decisions</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get insights, analytics, and personalized recommendations based on your risk tolerance.
            </p>
          </div>
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
        >
          Let's Get Started
        </button>
      </div>
    </div>
  );
};

const ProfileSetupStep: React.FC<{ data: any; onDataChange: (data: any) => void }> = ({ onDataChange }) => {
  return (
    <div>
      <ProfileForm onSuccess={() => onDataChange({ completed: true })} />
    </div>
  );
};

const PreferencesSetupStep: React.FC<{ data: any; onDataChange: (data: any) => void }> = () => {
  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Set up your preferences to personalize your experience. You can always change these later.
      </p>
      <PreferencesPanel />
    </div>
  );
};

const SecuritySetupStep: React.FC<{ data: any; onDataChange: (data: any) => void }> = () => {
  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Secure your account with our recommended security settings. We highly recommend enabling two-factor authentication.
      </p>
      <SecurityOverview />
    </div>
  );
};

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to your new crypto portfolio dashboard',
    component: WelcomeStep,
  },
  {
    id: 'profile',
    title: 'Profile Setup',
    description: 'Tell us a bit about yourself',
    component: ProfileSetupStep,
    validation: (data) => {
      // Check if profile form was completed
      return data?.completed === true;
    },
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    component: PreferencesSetupStep,
    optional: true,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Secure your account',
    component: SecuritySetupStep,
    optional: true,
  },
];

export const OnboardingPage: React.FC = () => {
  const { user } = useAuth();

  const handleOnboardingComplete = () => {
    // Redirect to dashboard after onboarding
    window.location.href = '/dashboard';
  };

  // If user is not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <OnboardingWizard
      steps={onboardingSteps}
      onComplete={handleOnboardingComplete}
    />
  );
};