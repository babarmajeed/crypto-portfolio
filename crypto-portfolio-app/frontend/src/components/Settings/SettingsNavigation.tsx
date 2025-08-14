import React from 'react';
import { ChevronRight } from 'lucide-react';
import { SettingsSection } from '../../types/settings.types';

interface SettingsNavigationProps {
  sections: SettingsSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  hasUnsavedChanges?: boolean;
}

const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  sections,
  activeSection,
  onSectionChange,
  hasUnsavedChanges = false
}) => {
  const handleSectionClick = (sectionId: string) => {
    if (hasUnsavedChanges) {
      const confirmMessage = 'You have unsaved changes. Are you sure you want to switch sections?';
      if (window.confirm(confirmMessage)) {
        onSectionChange(sectionId);
      }
    } else {
      onSectionChange(sectionId);
    }
  };

  return (
    <div className="settings-navigation">
      <div className="navigation-header">
        <h2>Settings</h2>
        {hasUnsavedChanges && (
          <div className="unsaved-badge" title="You have unsaved changes">
            <span className="unsaved-dot"></span>
          </div>
        )}
      </div>

      <nav className="navigation-menu">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => handleSectionClick(section.id)}
            type="button"
          >
            <div className="nav-item-content">
              <div className="nav-item-icon">
                <span className="icon-emoji">{section.icon}</span>
              </div>
              
              <div className="nav-item-text">
                <span className="nav-item-name">{section.name}</span>
                {section.description && (
                  <span className="nav-item-description">{section.description}</span>
                )}
              </div>
            </div>
            
            <ChevronRight 
              className={`nav-item-arrow ${activeSection === section.id ? 'active' : ''}`} 
              size={16} 
            />
          </button>
        ))}
      </nav>

      <div className="navigation-footer">
        <div className="app-info">
          <span className="app-name">Crypto Portfolio</span>
          <span className="app-version">v1.0.0</span>
        </div>
        
        <div className="sync-status">
          <div className="sync-indicator online" title="Settings synced">
            <div className="sync-dot"></div>
            <span>Synced</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsNavigation;