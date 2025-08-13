import React from 'react';
import { ProfileForm } from '../../components/user/profile/ProfileForm';
import { ProfilePicture } from '../../components/user/profile/ProfilePicture';
import { AccountSettings } from '../../components/user/profile/AccountSettings';
import { useProfile } from '../../hooks/useProfile';

export const ProfilePage: React.FC = () => {
  const { profile, isLoadingProfile } = useProfile();

  if (isLoadingProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center gap-6 mb-8">
            <div className="h-20 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-6 mb-8">
        <ProfilePicture size="xl" editable={true} />
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {profile ? `${profile.firstName} ${profile.lastName}` : 'Your Profile'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your personal information and account settings
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="mb-8">
        <ProfileForm />
      </div>

      {/* Account Settings */}
      <AccountSettings />
    </div>
  );
};