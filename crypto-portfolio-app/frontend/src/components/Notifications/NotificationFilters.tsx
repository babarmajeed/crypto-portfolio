import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NotificationFiltersProps } from '../../types/notification.types';

const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  categories,
  activeFilter,
  onFilterChange,
  showSearch = true,
  onSearch,
  searchQuery = ''
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search handling
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(localSearchQuery);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [localSearchQuery, onSearch]);

  // Sync external search query changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setLocalSearchQuery('');
    if (onSearch) {
      onSearch('');
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchClear();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (onSearch) {
        onSearch(localSearchQuery);
      }
    }
  }, [localSearchQuery, onSearch, handleSearchClear]);

  const handleFilterChange = useCallback((filterId: string) => {
    onFilterChange(filterId);
  }, [onFilterChange]);

  // Show only first 5 categories by default, with option to show all
  const visibleCategories = showAllFilters ? categories : categories.slice(0, 5);
  const hasHiddenCategories = categories.length > 5;

  return (
    <div className="notification-filters">
      {/* Search Bar */}
      {showSearch && (
        <div className="search-container">
          <div className="search-input-wrapper">
            <input
              ref={searchInputRef}
              type="text"
              value={localSearchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Search notifications..."
              className="search-input"
              aria-label="Search notifications"
            />
            <div className="search-icon" aria-hidden="true">
              🔍
            </div>
            {localSearchQuery && (
              <button
                onClick={handleSearchClear}
                className="search-clear"
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          
          {localSearchQuery && (
            <div className="search-status" role="status" aria-live="polite">
              Searching for "{localSearchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Filter Categories */}
      <div className="filter-categories">
        <div className="category-tabs" role="tablist" aria-label="Notification categories">
          {visibleCategories.map(category => (
            <button
              key={category.id}
              onClick={() => handleFilterChange(category.id)}
              className={`category-tab ${activeFilter === category.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeFilter === category.id}
              aria-controls={`panel-${category.id}`}
              title={`Show ${category.name} notifications (${category.count})`}
            >
              <span className="category-name">{category.name}</span>
              {category.count > 0 && (
                <span 
                  className={`category-count ${category.id === 'unread' && category.count > 0 ? 'highlight' : ''}`}
                  aria-label={`${category.count} notifications`}
                >
                  {category.count > 999 ? '999+' : category.count}
                </span>
              )}
            </button>
          ))}
          
          {/* Show More/Less Button */}
          {hasHiddenCategories && (
            <button
              onClick={() => setShowAllFilters(!showAllFilters)}
              className="show-more-filters"
              aria-label={showAllFilters ? 'Show fewer filters' : 'Show more filters'}
            >
              {showAllFilters ? (
                <>
                  <span>Less</span>
                  <span className="chevron up" aria-hidden="true">▲</span>
                </>
              ) : (
                <>
                  <span>More</span>
                  <span className="chevron down" aria-hidden="true">▼</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Filter Summary */}
        <div className="filter-summary" role="status" aria-live="polite">
          {activeFilter === 'all' ? (
            <span>Showing all notifications</span>
          ) : (
            <span>
              Filtered by: {categories.find(c => c.id === activeFilter)?.name}
              {localSearchQuery && ` • Search: "${localSearchQuery}"`}
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="filter-actions">
        <div className="quick-filters">
          <button
            onClick={() => handleFilterChange('unread')}
            className={`quick-filter ${activeFilter === 'unread' ? 'active' : ''}`}
            disabled={categories.find(c => c.id === 'unread')?.count === 0}
            title="Show only unread notifications"
          >
            <span className="filter-icon" aria-hidden="true">📬</span>
            Unread
          </button>
          
          <button
            onClick={() => handleFilterChange('price_alert')}
            className={`quick-filter ${activeFilter === 'price_alert' ? 'active' : ''}`}
            disabled={categories.find(c => c.id === 'price_alert')?.count === 0}
            title="Show price alerts"
          >
            <span className="filter-icon" aria-hidden="true">📈</span>
            Alerts
          </button>
          
          <button
            onClick={() => handleFilterChange('security')}
            className={`quick-filter ${activeFilter === 'security' ? 'active' : ''}`}
            disabled={categories.find(c => c.id === 'security')?.count === 0}
            title="Show security notifications"
          >
            <span className="filter-icon" aria-hidden="true">🔒</span>
            Security
          </button>
        </div>

        {/* Reset Filters */}
        {(activeFilter !== 'all' || localSearchQuery) && (
          <button
            onClick={() => {
              handleFilterChange('all');
              handleSearchClear();
            }}
            className="reset-filters"
            title="Clear all filters"
            aria-label="Clear all filters"
          >
            <span className="reset-icon" aria-hidden="true">🔄</span>
            Reset
          </button>
        )}
      </div>

      {/* Advanced Search Options */}
      {showSearch && localSearchQuery && (
        <div className="search-suggestions">
          <div className="suggestions-header">Search suggestions:</div>
          <div className="suggestion-chips">
            <button
              onClick={() => setLocalSearchQuery('price')}
              className="suggestion-chip"
            >
              price
            </button>
            <button
              onClick={() => setLocalSearchQuery('portfolio')}
              className="suggestion-chip"
            >
              portfolio
            </button>
            <button
              onClick={() => setLocalSearchQuery('security')}
              className="suggestion-chip"
            >
              security
            </button>
            <button
              onClick={() => setLocalSearchQuery('today')}
              className="suggestion-chip"
            >
              today
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Info */}
      <div className="keyboard-shortcuts" aria-hidden="true">
        <div className="shortcut-info">
          <kbd>Esc</kbd> Clear search • <kbd>↑↓</kbd> Navigate • <kbd>Enter</kbd> Select
        </div>
      </div>
    </div>
  );
};

export default NotificationFilters;