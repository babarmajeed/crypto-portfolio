import React, { useEffect } from 'react';
import { Monitor, Sun, Moon, Palette, Clock, Calendar } from 'lucide-react';
import { usePreferences } from '../../../hooks/usePreferences';
import { UserPreferences } from '../../../types/user';

export const ThemeSettings: React.FC = () => {
  const { 
    preferences, 
    updateTheme, 
    updatePreferences,
    isUpdatingTheme, 
    isUpdating 
  } = usePreferences();

  const currentTheme = preferences?.theme || 'auto';
  const currentDateFormat = preferences?.dateFormat || 'DD/MM/YYYY';
  const currentTimeFormat = preferences?.timeFormat || '12h';

  const themeOptions = [
    {
      value: 'light' as const,
      label: 'Light',
      description: 'Clean and bright interface',
      icon: Sun,
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      description: 'Easy on the eyes in low light',
      icon: Moon,
    },
    {
      value: 'auto' as const,
      label: 'System',
      description: 'Follows your system preference',
      icon: Monitor,
    },
  ];

  const dateFormatOptions = [
    { value: 'DD/MM/YYYY' as const, label: 'DD/MM/YYYY', example: '31/12/2023' },
    { value: 'MM/DD/YYYY' as const, label: 'MM/DD/YYYY', example: '12/31/2023' },
    { value: 'YYYY-MM-DD' as const, label: 'YYYY-MM-DD', example: '2023-12-31' },
  ];

  const timeFormatOptions = [
    { value: '12h' as const, label: '12-hour', example: '2:30 PM' },
    { value: '24h' as const, label: '24-hour', example: '14:30' },
  ];

  const handleThemeChange = (theme: UserPreferences['theme']) => {
    updateTheme(theme);
  };

  const handleDateFormatChange = (dateFormat: UserPreferences['dateFormat']) => {
    updatePreferences({ dateFormat });
  };

  const handleTimeFormatChange = (timeFormat: UserPreferences['timeFormat']) => {
    updatePreferences({ timeFormat });
  };

  // Apply theme to document when component mounts or theme changes
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (theme: UserPreferences['theme']) => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // Auto theme - check system preference
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(currentTheme);

    // Listen for system theme changes when in auto mode
    if (currentTheme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('auto');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [currentTheme]);

  return (
    <div className="space-y-8">
      {/* Theme Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Theme
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose your preferred color scheme for the interface.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentTheme === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                disabled={isUpdatingTheme}
                className={`
                  relative p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                  ${isUpdatingTheme ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div>
                    <h4 className={`font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                      {option.label}
                    </h4>
                    <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      {option.description}
                    </p>
                  </div>
                </div>
                
                {isSelected && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Format */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Date Format
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose how dates are displayed throughout the application.
        </p>
        
        <div className="space-y-3">
          {dateFormatOptions.map((option) => (
            <label
              key={option.value}
              className={`
                flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors
                ${currentDateFormat === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="dateFormat"
                  value={option.value}
                  checked={currentDateFormat === option.value}
                  onChange={() => handleDateFormatChange(option.value)}
                  disabled={isUpdating}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                    ({option.example})
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Time Format */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Time Format
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose how times are displayed throughout the application.
        </p>
        
        <div className="space-y-3">
          {timeFormatOptions.map((option) => (
            <label
              key={option.value}
              className={`
                flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors
                ${currentTimeFormat === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="timeFormat"
                  value={option.value}
                  checked={currentTimeFormat === option.value}
                  onChange={() => handleTimeFormatChange(option.value)}
                  disabled={isUpdating}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                    ({option.example})
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};