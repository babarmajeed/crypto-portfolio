import React from 'react';
import { ShoppingCart, DollarSign, Star, Loader2 } from 'lucide-react';

interface QuickActionsProps {
  symbol: string;
  onBuy: () => void;
  onSell: () => void;
  onWatchlistToggle: () => void;
  isInWatchlist: boolean;
  hasHolding: boolean;
  layout?: 'grid' | 'list';
  isLoading?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  symbol,
  onBuy,
  onSell,
  onWatchlistToggle,
  isInWatchlist,
  hasHolding,
  layout = 'grid',
  isLoading = false
}) => {
  const handleAction = (action: () => void, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isLoading) {
      action();
    }
  };

  if (layout === 'list') {
    return (
      <div className="quick-actions quick-actions-list">
        <button
          className="action-btn buy-btn"
          onClick={(e) => handleAction(onBuy, e)}
          disabled={isLoading}
          title={`Buy ${symbol}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShoppingCart className="w-4 h-4" />
          )}
        </button>
        
        {hasHolding && (
          <button
            className="action-btn sell-btn"
            onClick={(e) => handleAction(onSell, e)}
            disabled={isLoading}
            title={`Sell ${symbol}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
          </button>
        )}
        
        <button
          className={`action-btn watchlist-btn ${isInWatchlist ? 'active' : ''}`}
          onClick={(e) => handleAction(onWatchlistToggle, e)}
          disabled={isLoading}
          title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Star className="w-4 h-4" fill={isInWatchlist ? 'currentColor' : 'none'} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="quick-actions quick-actions-grid">
      <button
        className="action-btn buy-btn primary"
        onClick={(e) => handleAction(onBuy, e)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <ShoppingCart className="w-4 h-4 mr-2" />
        )}
        Buy {symbol}
      </button>
      
      {hasHolding && (
        <button
          className="action-btn sell-btn secondary"
          onClick={(e) => handleAction(onSell, e)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <DollarSign className="w-4 h-4 mr-2" />
          )}
          Sell {symbol}
        </button>
      )}
      
      <button
        className={`action-btn watchlist-btn ${isInWatchlist ? 'active' : 'outline'}`}
        onClick={(e) => handleAction(onWatchlistToggle, e)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Star className="w-4 h-4 mr-2" fill={isInWatchlist ? 'currentColor' : 'none'} />
        )}
        {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
      </button>
    </div>
  );
};

export default QuickActions;