import React, { useState, useCallback, useRef } from 'react';
import { Star, TrendingUp, TrendingDown, MoreVertical, ShoppingCart, Eye } from 'lucide-react';
import { useAssetData } from '../../hooks/useAsset/useAssetData';
import { useAssetActions } from '../../hooks/useAsset/useAssetActions';
import { useResponsive } from '../../hooks/useResponsive';
import { useTouch } from '../../hooks/useTouch';
import { useSwipe } from '../../hooks/useSwipe';
import AssetSparkline from './AssetSparkline';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';

interface TouchOptimizedAssetCardProps {
  symbol: string;
  viewMode?: 'grid' | 'list' | 'compact';
  onCardClick?: (symbol: string, assetData: any) => void;
  onCardLongPress?: (symbol: string, assetData: any) => void;
  onSwipeAction?: (symbol: string, action: 'buy' | 'sell' | 'favorite') => void;
  showQuickActions?: boolean;
  enableSwipeActions?: boolean;
  className?: string;
}

interface SwipeActionsProps {
  onBuy: () => void;
  onSell: () => void;
  onFavorite: () => void;
  hasHolding: boolean;
  isInWatchlist: boolean;
}

const SwipeActions: React.FC<SwipeActionsProps> = ({
  onBuy,
  onSell,
  onFavorite,
  hasHolding,
  isInWatchlist
}) => (
  <div className="absolute inset-0 flex">
    {/* Left swipe actions */}
    <div className="flex items-center justify-center w-20 bg-green-500">
      <button
        onClick={onBuy}
        className="flex flex-col items-center justify-center text-white touch-target"
        aria-label="Buy asset"
      >
        <ShoppingCart size={20} />
        <span className="text-xs mt-1">Buy</span>
      </button>
    </div>
    
    {/* Right swipe actions */}
    <div className="flex ml-auto">
      {hasHolding && (
        <div className="flex items-center justify-center w-20 bg-red-500">
          <button
            onClick={onSell}
            className="flex flex-col items-center justify-center text-white touch-target"
            aria-label="Sell asset"
          >
            <ShoppingCart size={20} className="rotate-180" />
            <span className="text-xs mt-1">Sell</span>
          </button>
        </div>
      )}
      <div className="flex items-center justify-center w-20 bg-yellow-500">
        <button
          onClick={onFavorite}
          className="flex flex-col items-center justify-center text-white touch-target"
          aria-label={isInWatchlist ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={20} fill={isInWatchlist ? "currentColor" : "none"} />
          <span className="text-xs mt-1">{isInWatchlist ? 'Remove' : 'Add'}</span>
        </button>
      </div>
    </div>
  </div>
);

const TouchOptimizedAssetCard: React.FC<TouchOptimizedAssetCardProps> = ({
  symbol,
  viewMode = 'grid',
  onCardClick,
  onCardLongPress,
  onSwipeAction,
  showQuickActions = true,
  enableSwipeActions = true,
  className = ''
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [swipeTransform, setSwipeTransform] = useState(0);
  const [showSwipeActions, setShowSwipeActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { isMobile, isTablet } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

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

  // Touch gesture handlers
  const touchHandlers = useTouch({
    onTap: (point) => {
      if (showSwipeActions) {
        setShowSwipeActions(false);
        setSwipeTransform(0);
        return;
      }
      
      if (onCardClick && assetData) {
        onCardClick(symbol, assetData);
      }
    },
    onLongPress: (point) => {
      if (onCardLongPress && assetData) {
        onCardLongPress(symbol, assetData);
      } else {
        setShowActions(!showActions);
      }
    },
    onPanStart: () => {
      if (enableSwipeActions && isTouchDevice) {
        setIsPressed(true);
      }
    },
    onPan: (point, delta) => {
      if (enableSwipeActions && isTouchDevice) {
        const maxSwipe = 100;
        const transform = Math.max(-maxSwipe, Math.min(maxSwipe, delta.x));
        setSwipeTransform(transform);
        
        if (Math.abs(transform) > 40) {
          setShowSwipeActions(true);
        }
      }
    },
    onPanEnd: (point, velocity) => {
      setIsPressed(false);
      
      if (enableSwipeActions && isTouchDevice) {
        const threshold = 50;
        const velocityThreshold = 0.5;
        
        if (Math.abs(swipeTransform) > threshold || Math.abs(velocity.x) > velocityThreshold) {
          if (swipeTransform > 0) {
            // Swiped right - Buy action
            onSwipeAction?.(symbol, 'buy');
            handleBuy();
          } else {
            // Swiped left - Sell or Favorite action
            if (holdingData?.quantity && holdingData.quantity > 0) {
              onSwipeAction?.(symbol, 'sell');
              handleSell();
            } else {
              onSwipeAction?.(symbol, 'favorite');
              handleWatchlistToggle();
            }
          }
        }
        
        // Reset swipe state
        setTimeout(() => {
          setSwipeTransform(0);
          setShowSwipeActions(false);
        }, 200);
      }
    }
  });

  // Swipe gesture handlers (alternative approach)
  const swipeHandlers = useSwipe({
    threshold: 30,
    onSwipeStart: () => {
      if (enableSwipeActions && isTouchDevice) {
        setIsPressed(true);
      }
    },
    onSwipe: (direction, distance, velocity) => {
      if (!enableSwipeActions || !isTouchDevice) return;
      
      if (direction === 'right') {
        onSwipeAction?.(symbol, 'buy');
        handleBuy();
      } else if (direction === 'left') {
        if (holdingData?.quantity && holdingData.quantity > 0) {
          onSwipeAction?.(symbol, 'sell');
          handleSell();
        } else {
          onSwipeAction?.(symbol, 'favorite');
          handleWatchlistToggle();
        }
      }
    }
  });

  const handleBuy = useCallback(() => {
    openBuyModal();
  }, [openBuyModal]);

  const handleSell = useCallback(() => {
    openSellModal();
  }, [openSellModal]);

  const handleWatchlistToggle = useCallback(() => {
    if (isInWatchlist) {
      removeFromWatchlist();
    } else {
      addToWatchlist();
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  if (isLoading) {
    return (
      <div className={`asset-card-skeleton ${viewMode} ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error || !assetData) {
    return (
      <div className={`asset-card-error ${viewMode} ${className}`}>
        <div className="text-center p-4">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <div className="text-sm text-gray-600">Failed to load {symbol}</div>
          <button 
            onClick={refresh}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 touch-target"
          >
            Retry
          </button>
        </div>
      </div>
    );
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
    unrealizedPnL = 0,
    unrealizedPnLPercentage = 0
  } = holdingData || {};

  const isPositiveChange = (priceChangePercentage24h || 0) >= 0;
  const isPositivePnL = unrealizedPnL >= 0;
  const hasHolding = quantity > 0;

  const cardClasses = [
    'relative overflow-hidden transition-all duration-200',
    'bg-white rounded-xl border border-gray-200',
    'touch-manipulation', // Optimize for touch
    isTouchDevice ? 'active:scale-98' : 'hover:shadow-lg hover:border-gray-300',
    isPressed ? 'scale-98 shadow-sm' : '',
    showSwipeActions ? 'z-10' : '',
    viewMode === 'compact' ? 'p-3' : 'p-4',
    className
  ].filter(Boolean).join(' ');

  const combinedHandlers = isTouchDevice 
    ? { ...touchHandlers, ...swipeHandlers }
    : {};

  // Compact view for mobile lists
  if (viewMode === 'compact') {
    return (
      <div
        ref={cardRef}
        className={cardClasses}
        style={{
          transform: enableSwipeActions && isTouchDevice 
            ? `translateX(${swipeTransform}px)` 
            : undefined
        }}
        {...combinedHandlers}
      >
        {/* Swipe action background */}
        {showSwipeActions && (
          <SwipeActions
            onBuy={handleBuy}
            onSell={handleSell}
            onFavorite={handleWatchlistToggle}
            hasHolding={hasHolding}
            isInWatchlist={isInWatchlist}
          />
        )}

        {/* Main card content */}
        <div className="relative bg-white flex items-center justify-between min-h-16">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <img 
              src={icon} 
              alt={symbol} 
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm truncate">
                  {symbol}
                </h3>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 text-sm">
                    {formatCurrency(currentPrice)}
                  </div>
                  <div className={`flex items-center justify-end text-xs ${
                    isPositiveChange ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveChange ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span className="ml-1">
                      {formatPercentage(priceChangePercentage24h)}
                    </span>
                  </div>
                </div>
              </div>
              
              {hasHolding && (
                <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                  <span>{formatNumber(quantity)} {symbol}</span>
                  <span className={isPositivePnL ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(unrealizedPnL)} ({formatPercentage(unrealizedPnLPercentage)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {showQuickActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="ml-2 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 touch-target"
              aria-label="More actions"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>

        {/* Quick actions menu */}
        {showActions && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-32">
            <button
              onClick={handleBuy}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 first:rounded-t-lg touch-target"
            >
              Buy {symbol}
            </button>
            {hasHolding && (
              <button
                onClick={handleSell}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 touch-target"
              >
                Sell {symbol}
              </button>
            )}
            <button
              onClick={handleWatchlistToggle}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 last:rounded-b-lg touch-target"
            >
              {isInWatchlist ? 'Remove from' : 'Add to'} Watchlist
            </button>
          </div>
        )}
      </div>
    );
  }

  // Grid view for larger screens
  return (
    <div
      ref={cardRef}
      className={cardClasses}
      style={{
        transform: enableSwipeActions && isTouchDevice 
          ? `translateX(${swipeTransform}px)` 
          : undefined
      }}
      {...combinedHandlers}
    >
      {/* Swipe action background */}
      {showSwipeActions && (
        <SwipeActions
          onBuy={handleBuy}
          onSell={handleSell}
          onFavorite={handleWatchlistToggle}
          hasHolding={hasHolding}
          isInWatchlist={isInWatchlist}
        />
      )}

      {/* Main card content */}
      <div className="relative bg-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <img 
              src={icon} 
              alt={symbol} 
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{symbol}</h3>
              <p className="text-sm text-gray-600 truncate max-w-32">{name}</p>
              <span className="text-xs text-gray-500">#{rank}</span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleWatchlistToggle();
            }}
            className={`p-2 rounded-full transition-colors touch-target ${
              isInWatchlist 
                ? 'text-yellow-500 bg-yellow-50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            disabled={actionsLoading}
            aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Star size={20} fill={isInWatchlist ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Price section */}
        <div className="mb-4">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`flex items-center text-sm ${
            isPositiveChange ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositiveChange ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="ml-1">
              {formatCurrency(priceChange24h)} ({formatPercentage(priceChangePercentage24h)})
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-4">
          <AssetSparkline
            data={priceHistory}
            color={isPositiveChange ? '#10b981' : '#ef4444'}
            width={280}
            height={60}
          />
        </div>

        {/* Holdings section */}
        {hasHolding && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">Holdings</p>
                <p className="font-semibold text-gray-900">
                  {formatNumber(quantity)} {symbol}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Value</p>
                <p className="font-semibold text-gray-900">{formatCurrency(value)}</p>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Unrealized P&L</span>
                <span className={`text-sm font-semibold ${
                  isPositivePnL ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(unrealizedPnL)} ({formatPercentage(unrealizedPnLPercentage)})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Market data */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-600">Market Cap</p>
            <p className="font-semibold text-gray-900">{formatNumber(marketCap)}</p>
          </div>
          <div>
            <p className="text-gray-600">24h Volume</p>
            <p className="font-semibold text-gray-900">{formatNumber(volume24h)}</p>
          </div>
        </div>

        {/* Action buttons */}
        {showQuickActions && (
          <div className="flex space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBuy();
              }}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors touch-target"
              disabled={actionsLoading}
            >
              Buy
            </button>
            
            {hasHolding && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSell();
                }}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-red-700 active:bg-red-800 transition-colors touch-target"
                disabled={actionsLoading}
              >
                Sell
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCardClick?.(symbol, assetData);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
            >
              <Eye size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TouchOptimizedAssetCard;