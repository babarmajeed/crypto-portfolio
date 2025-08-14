import React, { useState } from 'react';
import { Download, Maximize2, Minimize2, Settings, Camera, FileText, Palette, Monitor, Sun, Moon } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

interface ChartSettingsProps {
  onExport: (format: 'png' | 'csv') => void;
  onFullscreenToggle: () => void;
  isFullscreen: boolean;
  theme: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  className?: string;
}

const ChartSettings: React.FC<ChartSettingsProps> = ({
  onExport,
  onFullscreenToggle,
  isFullscreen,
  theme,
  onThemeChange,
  className = ''
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const { isMobile } = useResponsive();

  const handleExport = (format: 'png' | 'csv') => {
    onExport(format);
    setShowExportMenu(false);
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    onThemeChange?.(newTheme);
  };

  const exportOptions = [
    {
      format: 'png' as const,
      label: 'Export as PNG',
      description: 'Save chart as image',
      icon: Camera,
    },
    {
      format: 'csv' as const,
      label: 'Export as CSV',
      description: 'Download chart data',
      icon: FileText,
    },
  ];

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Theme Toggle */}
      {onThemeChange && (
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Export Menu */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Export chart"
        >
          <Download className="w-4 h-4" />
        </button>

        {showExportMenu && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowExportMenu(false)}
            />
            
            {/* Export menu */}
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-48">
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
                  Export Options
                </div>
                <div className="space-y-1">
                  {exportOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.format}
                        onClick={() => handleExport(option.format)}
                        className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                      >
                        <IconComponent className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Toggle */}
      <button
        onClick={onFullscreenToggle}
        className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        )}
      </button>

      {/* Settings Menu */}
      {!isMobile && (
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Chart settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {showSettingsMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowSettingsMenu(false)}
              />
              
              {/* Settings menu */}
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-64">
                <div className="p-4">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Chart Settings
                  </div>
                  
                  <div className="space-y-4">
                    {/* Theme Selection */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Theme
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onThemeChange?.('light')}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                            theme === 'light'
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Sun className="w-4 h-4" />
                          <span>Light</span>
                        </button>
                        <button
                          onClick={() => onThemeChange?.('dark')}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                            theme === 'dark'
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Moon className="w-4 h-4" />
                          <span>Dark</span>
                        </button>
                      </div>
                    </div>

                    {/* Chart Appearance */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Appearance
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Show grid lines</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Show crosshair</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Show volume</span>
                        </label>
                      </div>
                    </div>

                    {/* Price Scale */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Price Scale
                      </label>
                      <select className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="normal">Normal</option>
                        <option value="logarithmic">Logarithmic</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={() => setShowSettingsMenu(false)}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                      >
                        Close
                      </button>
                      <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChartSettings;