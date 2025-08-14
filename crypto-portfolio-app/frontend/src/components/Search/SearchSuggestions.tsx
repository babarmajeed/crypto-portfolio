import React, { forwardRef } from 'react';
import { History, TrendingUp, Search, Clock, X } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface Suggestion {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  currentPrice?: number;
  priceChangePercentage24h?: number;
  marketCapRank?: number;
}

interface SearchSuggestionsProps {
  query: string;
  suggestions: Suggestion[];
  searchHistory: Suggestion[];
  trendingSearches: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  onClearHistory: () => void;
  isLoading: boolean;
}

const SearchSuggestions = forwardRef<HTMLDivElement, SearchSuggestionsProps>(
  ({ query, suggestions, searchHistory, trendingSearches, onSelect, onClearHistory, isLoading }, ref) => {
    const highlightMatch = (text: string, query: string) => {
      if (!query) return text;
      
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = text.split(regex);
      
      return parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className="search-highlight">{part}</mark>
        ) : part
      );
    };

    const handleSuggestionClick = (suggestion: Suggestion, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(suggestion);
    };

    const handleKeyDown = (suggestion: Suggestion, event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(suggestion);
      }
    };

    const renderSuggestionItem = (suggestion: Suggestion, showPrice: boolean = true) => (
      <div
        key={suggestion.id || suggestion.symbol}
        className="suggestion-item"
        onClick={(e) => handleSuggestionClick(suggestion, e)}
        onKeyDown={(e) => handleKeyDown(suggestion, e)}
        tabIndex={0}
        role="button"
      >
        <div className="suggestion-main">
          <div className="suggestion-icon">
            {suggestion.image ? (
              <img src={suggestion.image} alt={suggestion.symbol} className="asset-icon" />
            ) : (
              <div className="asset-icon-placeholder">
                {suggestion.symbol ? suggestion.symbol.charAt(0) : '?'}
              </div>
            )}
          </div>
          
          <div className="suggestion-info">
            <div className="suggestion-primary">
              <span className="symbol">
                {highlightMatch(suggestion.symbol, query)}
              </span>
              {suggestion.marketCapRank && (
                <span className="rank">#{suggestion.marketCapRank}</span>
              )}
            </div>
            <div className="suggestion-secondary">
              {highlightMatch(suggestion.name, query)}
            </div>
          </div>
        </div>

        {showPrice && suggestion.currentPrice && (
          <div className="suggestion-price">
            <div className="price">
              {formatCurrency(suggestion.currentPrice)}
            </div>
            {suggestion.priceChangePercentage24h !== undefined && (
              <div className={`price-change ${suggestion.priceChangePercentage24h >= 0 ? 'positive' : 'negative'}`}>
                {suggestion.priceChangePercentage24h >= 0 ? '+' : ''}
                {formatPercentage(suggestion.priceChangePercentage24h)}
              </div>
            )}
          </div>
        )}
      </div>
    );

    const hasContent = suggestions.length > 0 || searchHistory.length > 0 || trendingSearches.length > 0;

    if (!hasContent && !isLoading) {
      return null;
    }

    return (
      <div ref={ref} className="search-suggestions">
        {isLoading && (
          <div className="suggestions-loading">
            <div className="loading-spinner-small"></div>
            <span>Searching...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Search Results */}
            {suggestions.length > 0 && (
              <div className="suggestions-section">
                <div className="suggestions-header">
                  <Search size={14} />
                  <span>Search Results</span>
                </div>
                <div className="suggestions-list">
                  {suggestions.map((suggestion) => renderSuggestionItem(suggestion, true))}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {query.length === 0 && searchHistory.length > 0 && (
              <div className="suggestions-section">
                <div className="suggestions-header">
                  <History size={14} />
                  <span>Recent Searches</span>
                  <button
                    className="clear-history-btn"
                    onClick={onClearHistory}
                    title="Clear search history"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="suggestions-list">
                  {searchHistory.slice(0, 5).map((item) => (
                    <div
                      key={`history-${item.symbol}`}
                      className="suggestion-item history-item"
                      onClick={(e) => handleSuggestionClick(item, e)}
                      onKeyDown={(e) => handleKeyDown(item, e)}
                      tabIndex={0}
                      role="button"
                    >
                      <Clock size={14} className="history-icon" />
                      <div className="suggestion-info">
                        <div className="suggestion-primary">
                          <span className="symbol">{item.symbol}</span>
                        </div>
                        <div className="suggestion-secondary">
                          {item.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            {query.length === 0 && trendingSearches.length > 0 && (
              <div className="suggestions-section">
                <div className="suggestions-header">
                  <TrendingUp size={14} />
                  <span>Trending</span>
                </div>
                <div className="suggestions-list">
                  {trendingSearches.slice(0, 5).map((item) => (
                    <div
                      key={`trending-${item.symbol}`}
                      className="suggestion-item trending-item"
                      onClick={(e) => handleSuggestionClick(item, e)}
                      onKeyDown={(e) => handleKeyDown(item, e)}
                      tabIndex={0}
                      role="button"
                    >
                      <div className="suggestion-main">
                        <div className="suggestion-icon">
                          {item.image ? (
                            <img src={item.image} alt={item.symbol} className="asset-icon" />
                          ) : (
                            <div className="asset-icon-placeholder">
                              {item.symbol.charAt(0)}
                            </div>
                          )}
                        </div>
                        
                        <div className="suggestion-info">
                          <div className="suggestion-primary">
                            <span className="symbol">{item.symbol}</span>
                            <TrendingUp size={12} className="trending-icon" />
                          </div>
                          <div className="suggestion-secondary">
                            {item.name}
                          </div>
                        </div>
                      </div>

                      {item.currentPrice && (
                        <div className="suggestion-price">
                          <div className="price">
                            {formatCurrency(item.currentPrice)}
                          </div>
                          {item.priceChangePercentage24h !== undefined && (
                            <div className={`price-change ${item.priceChangePercentage24h >= 0 ? 'positive' : 'negative'}`}>
                              {item.priceChangePercentage24h >= 0 ? '+' : ''}
                              {formatPercentage(item.priceChangePercentage24h)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {query.length >= 2 && suggestions.length === 0 && !isLoading && (
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <div className="no-results-text">
                  <div className="no-results-title">No results found</div>
                  <div className="no-results-subtitle">
                    Try searching for a different cryptocurrency name or symbol
                  </div>
                </div>
              </div>
            )}

            {/* Search Tips */}
            {query.length === 0 && searchHistory.length === 0 && trendingSearches.length === 0 && (
              <div className="search-tips">
                <div className="search-tips-header">Search Tips</div>
                <div className="search-tips-list">
                  <div className="search-tip">
                    <span className="tip-icon">💡</span>
                    Search by symbol (e.g., "BTC") or name (e.g., "Bitcoin")
                  </div>
                  <div className="search-tip">
                    <span className="tip-icon">🔍</span>
                    Use filters to narrow down results by price, market cap, or category
                  </div>
                  <div className="search-tip">
                    <span className="tip-icon">⭐</span>
                    Your recent searches will appear here for quick access
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

SearchSuggestions.displayName = 'SearchSuggestions';

export default SearchSuggestions;