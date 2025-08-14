import React, { useState, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Eye, EyeOff } from 'lucide-react';
import { useAssetData } from '../../hooks/useAsset/useAssetData';
import { useAssetActions } from '../../hooks/useAsset/useAssetActions';
import AssetSparkline from './AssetSparkline';
import QuickActions from './QuickActions';
import AssetMetrics from './AssetMetrics';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';

interface AssetCardProps {
  symbol: string;
  viewMode?: 'grid' | 'list';
  onCardClick?: (symbol: string, assetData: any) => void;
  showQuickActions?: boolean;
  className?: string;
}

interface AssetCardSkeletonProps {
  viewMode: 'grid' | 'list';
}

interface AssetCardErrorProps {
  symbol: string;
  error: any;
  onRetry?: () => void;
}

const AssetCardSkeleton: React.FC<AssetCardSkeletonProps> = ({ viewMode }) => {
  const skeletonClass = `asset-card asset-card-${viewMode} skeleton`;
  
  if (viewMode === 'list') {
    return (
      <div className={skeletonClass}>
        <div className="skeleton-content">
          <div className="skeleton-row">
            <div className="skeleton-circle w-8 h-8"></div>
            <div className="skeleton-text w-16 h-4"></div>
            <div className="skeleton-text w-24 h-3"></div>
          </div>
          <div className="skeleton-text w-20 h-4"></div>
          <div className="skeleton-text w-16 h-4"></div>
          <div className="skeleton-rect w-20 h-8"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={skeletonClass}>
      <div className="skeleton-header">
        <div className="skeleton-circle w-12 h-12"></div>
        <div className="skeleton-text w-16 h-4"></div>
      </div>
      <div className="skeleton-body">
        <div className="skeleton-text w-24 h-6"></div>
        <div className="skeleton-text w-20 h-4"></div>
        <div className="skeleton-rect w-full h-16"></div>
      </div>
    </div>
  );
};

const AssetCardError: React.FC<AssetCardErrorProps> = ({ symbol, error, onRetry }) => {
  return (
    <div className="asset-card error-card">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <div className="error-message">
          <h4>Failed to load {symbol}</h4>
          <p>{error.message || 'Unknown error occurred'}</p>
        </div>
        {onRetry && (
          <button className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

const AssetCard: React.FC<AssetCardProps> = ({
  symbol,
  viewMode = 'grid',
  onCardClick,
  showQuickActions = true,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const {
    assetData,
    holdingData,
    priceHistory,
    isLoading,
    error,
    refresh
  } = useAssetData(symbol);

  const {
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    openBuyModal,
    openSellModal,
    isLoading: actionsLoading
  } = useAssetActions(symbol);

  const handleCardClick = useCallback(() => {
    if (onCardClick && assetData) {
      onCardClick(symbol, assetData);
    } else {
      setShowDetails(!showDetails);
    }
  }, [onCardClick, symbol, assetData, showDetails]);

  const handleWatchlistToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInWatchlist) {
      removeFromWatchlist();
    } else {
      addToWatchlist();
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  if (isLoading) {
    return <AssetCardSkeleton viewMode={viewMode} />;
  }

  if (error) {
    return <AssetCardError symbol={symbol} error={error} onRetry={refresh} />;
  }

  if (!assetData) {
    return null;
  }

  const {
    name,
    currentPrice,
    priceChange24h,
    priceChangePercentage24h,
    marketCap,
    volume24h,
    rank,
    image: icon
  } = assetData;

  const {
    quantity = 0,
    value = 0,
    averageCostBasis = 0,
    unrealizedPnL = 0,
    unrealizedPnLPercentage = 0
  } = holdingData || {};

  const isPositiveChange = (priceChangePercentage24h || 0) >= 0;
  const isPositivePnL = unrealizedPnL >= 0;
  const hasHolding = quantity > 0;

  const cardClasses = [
    'asset-card',
    `asset-card-${viewMode}`,
    isHovered ? 'hovered' : '',
    hasHolding ? 'has-holding' : '',
    className
  ].filter(Boolean).join(' ');

  if (viewMode === 'list') {
    return (
      <div
        className={cardClasses}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
      >
        <div className="asset-basic-info">
          <div className="asset-icon-name">
            <img src={icon} alt={symbol} className="asset-icon" />
            <div className="asset-names">
              <span className="asset-symbol">{symbol}</span>
              <span className="asset-name">{name}</span>
            </div>
          </div>
          <div className="asset-rank">#{rank}</div>
        </div>

        <div className="asset-price-info">
          <div className="current-price">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`price-change ${isPositiveChange ? 'positive' : 'negative'}`}>
            <span className="change-icon">
              {isPositiveChange ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
            {isPositiveChange ? '+' : ''}{formatPercentage(priceChangePercentage24h)}
          </div>
        </div>

        <div className="asset-chart">
          <AssetSparkline
            data={priceHistory}
            color={isPositiveChange ? '#10b981' : '#ef4444'}
            width={120}
            height={40}
          />
        </div>

        {hasHolding && (
          <div className="holding-info">
            <div className="holding-value">
              {formatCurrency(value)}
            </div>
            <div className={`holding-pnl ${isPositivePnL ? 'positive' : 'negative'}`}>
              {isPositivePnL ? '+' : ''}{formatPercentage(unrealizedPnLPercentage)}
            </div>
          </div>
        )}

        <div className="asset-market-data">
          <div className="market-cap">
            <label>Market Cap</label>
            <span>{formatNumber(marketCap)}</span>
          </div>
          <div className="volume">
            <label>24h Volume</label>
            <span>{formatNumber(volume24h)}</span>
          </div>
        </div>

        {showQuickActions && (
          <QuickActions
            symbol={symbol}
            onBuy={() => openBuyModal()}
            onSell={() => openSellModal()}
            onWatchlistToggle={() => handleWatchlistToggle({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent)}
            isInWatchlist={isInWatchlist}
            hasHolding={hasHolding}
            layout="list"
            isLoading={actionsLoading}
          />
        )}
      </div>
    );
  }

  // Grid layout
  return (
    <div
      className={cardClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="card-header">
        <div className="asset-info">
          <img src={icon} alt={symbol} className="asset-icon" />
          <div className="asset-details">
            <h3 className="asset-symbol">{symbol}</h3>
            <p className="asset-name">{name}</p>
            <span className="asset-rank">#{rank}</span>
          </div>
        </div>

        <button
          className={`watchlist-btn ${isInWatchlist ? 'active' : ''}`}
          onClick={handleWatchlistToggle}
          disabled={actionsLoading}
          title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star size={16} fill={isInWatchlist ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="card-content">
        <div className="price-section">
          <div className="current-price">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`price-change ${isPositiveChange ? 'positive' : 'negative'}`}>
            <span className="change-amount">
              {isPositiveChange ? '+' : ''}{formatCurrency(priceChange24h)}
            </span>
            <span className="change-percentage">
              <span className="change-icon">
                {isPositiveChange ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              </span>
              ({isPositiveChange ? '+' : ''}{formatPercentage(priceChangePercentage24h)})
            </span>
          </div>
        </div>

        <div className="chart-section">
          <AssetSparkline
            data={priceHistory}
            color={isPositiveChange ? '#10b981' : '#ef4444'}
            width={280}
            height={60}
          />
        </div>

        {hasHolding && (
          <div className="holding-section">
            <div className="holding-summary">
              <div className="holding-quantity">
                <label>Holdings</label>
                <span>{formatNumber(quantity)} {symbol}</span>
              </div>
              <div className="holding-value">
                <label>Value</label>
                <span>{formatCurrency(value)}</span>
              </div>
            </div>

            <div className="pnl-section">
              <div className="cost-basis">
                <label>Avg Cost</label>
                <span>{formatCurrency(averageCostBasis)}</span>
              </div>
              <div className={`unrealized-pnl ${isPositivePnL ? 'positive' : 'negative'}`}>
                <label>Unrealized P&L</label>
                <span>
                  {isPositivePnL ? '+' : ''}{formatCurrency(unrealizedPnL)}
                  ({isPositivePnL ? '+' : ''}{formatPercentage(unrealizedPnLPercentage)})
                </span>
              </div>
            </div>
          </div>
        )}

        <AssetMetrics
          marketCap={marketCap}
          volume24h={volume24h}
          assetData={assetData}
          compact={!showDetails}
        />
      </div>

      {showQuickActions && (
        <div className="card-actions">
          <QuickActions
            symbol={symbol}
            onBuy={() => openBuyModal()}
            onSell={() => openSellModal()}
            onWatchlistToggle={() => handleWatchlistToggle({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent)}
            isInWatchlist={isInWatchlist}
            hasHolding={hasHolding}
            layout="grid"
            isLoading={actionsLoading}
          />
        </div>
      )}

      {showDetails && (
        <div className="card-details-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="details-content">
            <button
              className="close-details"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(false);
              }}
            >
              ×
            </button>
            <AssetMetrics
              marketCap={marketCap}
              volume24h={volume24h}
              assetData={assetData}
              compact={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetCard;