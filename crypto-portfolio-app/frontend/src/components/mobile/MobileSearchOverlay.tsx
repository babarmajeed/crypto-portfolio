import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ArrowLeft, TrendingUp } from 'lucide-react';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
  onSearch?: (query: string) => void;
  recentSearches?: string[];
  suggestions?: string[];
}

const MobileSearchOverlay: React.FC<MobileSearchOverlayProps> = ({
  isOpen,
  onClose,
  placeholder = 'Search assets...',
  onSearch,
  recentSearches = [],
  suggestions = ['Bitcoin', 'Ethereum', 'Cardano', 'Solana', 'Polygon']
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus input when overlay opens
      setTimeout(() => inputRef.current?.focus(), 100);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setQuery('');
      setShowSuggestions(true);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      onSearch?.(searchQuery.trim());
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(e.target.value.length < 3);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(query.toLowerCase())
  );

  const content = (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close search"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="flex-1 mx-3 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 text-lg bg-gray-100 dark:bg-gray-800 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
          
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {query && (
          <button
            onClick={() => handleSearch(query)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            Search
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showSuggestions && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                  Recent Searches
                </h3>
                <div className="space-y-2">
                  {recentSearches.slice(0, 5).map((recent, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(recent)}
                      className="flex items-center w-full p-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white">{recent}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending/Popular */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                Trending Assets
              </h3>
              <div className="space-y-2">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(suggestion)}
                    className="flex items-center w-full p-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <TrendingUp className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Search Results Placeholder */}
        {!showSuggestions && query && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Start typing to search for assets...
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default MobileSearchOverlay;