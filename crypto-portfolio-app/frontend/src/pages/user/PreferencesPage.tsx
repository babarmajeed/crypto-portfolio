import React from 'react';
import { PreferencesPanel } from '../../components/user/preferences/PreferencesPanel';

export const PreferencesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Preferences
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Customize your experience with personalized settings and preferences
        </p>
      </div>

      {/* Preferences Panel */}
      <PreferencesPanel />
    </div>
  );
};