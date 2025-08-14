import { useState, useEffect } from 'react';
import { ThemeDefinition, UseThemeReturn } from '../../types/settings.types';

const defaultThemes: ThemeDefinition[] = [
  {
    id: 'light',
    name: 'light',
    displayName: 'Light Theme',
    primaryColor: '#007bff',
    accentColor: '#28a745',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8f9fa',
    textColor: '#212529',
    isDark: false
  },
  {
    id: 'dark',
    name: 'dark',
    displayName: 'Dark Theme',
    primaryColor: '#0d6efd',
    accentColor: '#198754',
    backgroundColor: '#121212',
    surfaceColor: '#1e1e1e',
    textColor: '#ffffff',
    isDark: true
  },
  {
    id: 'auto',
    name: 'auto',
    displayName: 'System Auto',
    primaryColor: '#007bff',
    accentColor: '#28a745',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8f9fa',
    textColor: '#212529',
    isDark: false
  }
];

export const useTheme = (): UseThemeReturn => {
  const [themes, setThemes] = useState<ThemeDefinition[]>(defaultThemes);
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(defaultThemes[0]);

  useEffect(() => {
    // Load saved theme from localStorage
    const savedThemeId = localStorage.getItem('selectedTheme');
    if (savedThemeId) {
      const theme = themes.find(t => t.id === savedThemeId);
      if (theme) {
        setCurrentTheme(theme);
        applyTheme(theme);
      }
    } else {
      // Check system preference for auto theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const autoTheme = prefersDark ? 
        themes.find(t => t.id === 'dark') || defaultThemes[1] :
        themes.find(t => t.id === 'light') || defaultThemes[0];
      setCurrentTheme(autoTheme);
      applyTheme(autoTheme);
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (currentTheme.id === 'auto') {
        const autoTheme = e.matches ? 
          themes.find(t => t.id === 'dark') || defaultThemes[1] :
          themes.find(t => t.id === 'light') || defaultThemes[0];
        applyTheme(autoTheme);
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [themes, currentTheme.id]);

  const applyTheme = (theme: ThemeDefinition) => {
    const root = document.documentElement;
    
    // Set CSS custom properties
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--background-color', theme.backgroundColor);
    root.style.setProperty('--surface-color', theme.surfaceColor);
    root.style.setProperty('--text-color', theme.textColor);
    
    // Set theme attribute
    root.setAttribute('data-theme', theme.name);
    
    // Update meta theme-color for mobile browsers
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme.primaryColor);
    }
  };

  const setTheme = (themeId: string) => {
    let targetTheme = themes.find(t => t.id === themeId);
    
    if (!targetTheme) {
      console.warn(`Theme with id "${themeId}" not found`);
      return;
    }

    // Handle auto theme
    if (themeId === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 
        themes.find(t => t.id === 'dark') || defaultThemes[1] :
        themes.find(t => t.id === 'light') || defaultThemes[0];
      
      applyTheme(systemTheme);
    } else {
      applyTheme(targetTheme);
    }

    setCurrentTheme(targetTheme);
    localStorage.setItem('selectedTheme', themeId);
  };

  const toggleTheme = () => {
    if (currentTheme.id === 'light') {
      setTheme('dark');
    } else if (currentTheme.id === 'dark') {
      setTheme('light');
    } else {
      // If auto or custom, default to light
      setTheme('light');
    }
  };

  const createCustomTheme = (themeData: Partial<ThemeDefinition>): ThemeDefinition => {
    const customTheme: ThemeDefinition = {
      id: `custom-${Date.now()}`,
      name: 'custom',
      displayName: themeData.name || 'Custom Theme',
      primaryColor: themeData.primaryColor || '#007bff',
      accentColor: themeData.accentColor || '#28a745',
      backgroundColor: themeData.backgroundColor || '#ffffff',
      surfaceColor: themeData.surfaceColor || '#f8f9fa',
      textColor: themeData.textColor || '#212529',
      isDark: themeData.isDark || false
    };

    setThemes(prev => [...prev, customTheme]);
    
    // Save custom themes to localStorage
    const customThemes = themes.filter(t => t.id.startsWith('custom-'));
    localStorage.setItem('customThemes', JSON.stringify([...customThemes, customTheme]));

    return customTheme;
  };

  const deleteCustomTheme = (themeId: string) => {
    if (!themeId.startsWith('custom-')) {
      console.warn('Cannot delete built-in theme');
      return;
    }

    setThemes(prev => prev.filter(t => t.id !== themeId));
    
    // Update localStorage
    const customThemes = themes.filter(t => t.id.startsWith('custom-') && t.id !== themeId);
    localStorage.setItem('customThemes', JSON.stringify(customThemes));

    // If deleted theme was active, switch to light theme
    if (currentTheme.id === themeId) {
      setTheme('light');
    }
  };

  // Load custom themes on initialization
  useEffect(() => {
    try {
      const savedCustomThemes = localStorage.getItem('customThemes');
      if (savedCustomThemes) {
        const customThemes = JSON.parse(savedCustomThemes);
        setThemes(prev => [...prev.filter(t => !t.id.startsWith('custom-')), ...customThemes]);
      }
    } catch (error) {
      console.error('Failed to load custom themes:', error);
    }
  }, []);

  return {
    themes,
    currentTheme,
    setTheme,
    toggleTheme,
    createCustomTheme,
    deleteCustomTheme
  };
};