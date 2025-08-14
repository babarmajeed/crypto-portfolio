import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';

interface AssetMetricsProps {
  marketCap: number;
  volume24h: number;
  assetData: {
    totalSupply?: number;
    circulatingSupply?: number;
    maxSupply?: number;
    high24h?: number;
    low24h?: number;
    ath?: number;
    athDate?: string;
    atl?: number;
    atlDate?: string;
    priceChange7d?: number;
    priceChangePercentage7d?: number;
    priceChange30d?: number;
    priceChangePercentage30d?: number;
    marketCapRank?: number;
    fullyDilutedValuation?: number;
  };
  compact?: boolean;
}

const AssetMetrics: React.FC<AssetMetricsProps> = ({
  marketCap,
  volume24h,
  assetData,
  compact = true
}) => {
  const {
    totalSupply,
    circulatingSupply,
    maxSupply,
    high24h,
    low24h,
    ath,
    athDate,
    atl,
    atlDate,
    priceChange7d,
    priceChangePercentage7d,
    priceChange30d,
    priceChangePercentage30d,
    marketCapRank,
    fullyDilutedValuation
  } = assetData;

  const formatSupply = (supply: number | undefined) => {
    if (!supply) return 'N/A';
    return formatNumber(supply);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="asset-metrics compact">
        <div className="metrics-grid">
          <div className="metric">
            <label>Market Cap</label>
            <span>{formatNumber(marketCap)}</span>
          </div>
          <div className="metric">
            <label>24h Volume</label>
            <span>{formatNumber(volume24h)}</span>
          </div>
          {circulatingSupply && (
            <div className="metric">
              <label>Circulating</label>
              <span>{formatSupply(circulatingSupply)}</span>
            </div>
          )}
          {high24h && low24h && (
            <div className="metric">
              <label>24h Range</label>
              <span className="range">
                {formatCurrency(low24h)} - {formatCurrency(high24h)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="asset-metrics detailed">
      <div className="metrics-section">
        <h4 className="section-title">Market Data</h4>
        <div className="metrics-grid">
          <div className="metric">
            <div className="metric-icon">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="metric-content">
              <label>Market Cap</label>
              <span className="metric-value">{formatCurrency(marketCap)}</span>
              {marketCapRank && (
                <span className="metric-rank">Rank #{marketCapRank}</span>
              )}
            </div>
          </div>

          {fullyDilutedValuation && (
            <div className="metric">
              <div className="metric-content">
                <label>Fully Diluted Valuation</label>
                <span className="metric-value">{formatCurrency(fullyDilutedValuation)}</span>
              </div>
            </div>
          )}

          <div className="metric">
            <div className="metric-icon">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="metric-content">
              <label>24h Trading Volume</label>
              <span className="metric-value">{formatCurrency(volume24h)}</span>
            </div>
          </div>
        </div>
      </div>

      {(high24h || low24h || ath || atl) && (
        <div className="metrics-section">
          <h4 className="section-title">Price History</h4>
          <div className="metrics-grid">
            {high24h && low24h && (
              <div className="metric range-metric">
                <label>24h Range</label>
                <div className="range-bar">
                  <span className="range-low">{formatCurrency(low24h)}</span>
                  <div className="range-visual">
                    <div className="range-line"></div>
                    <div className="range-indicator"></div>
                  </div>
                  <span className="range-high">{formatCurrency(high24h)}</span>
                </div>
              </div>
            )}

            {ath && (
              <div className="metric">
                <div className="metric-icon text-green-500">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="metric-content">
                  <label>All-Time High</label>
                  <span className="metric-value">{formatCurrency(ath)}</span>
                  {athDate && (
                    <span className="metric-date">{formatDate(athDate)}</span>
                  )}
                </div>
              </div>
            )}

            {atl && (
              <div className="metric">
                <div className="metric-icon text-red-500">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="metric-content">
                  <label>All-Time Low</label>
                  <span className="metric-value">{formatCurrency(atl)}</span>
                  {atlDate && (
                    <span className="metric-date">{formatDate(atlDate)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(priceChange7d || priceChange30d) && (
        <div className="metrics-section">
          <h4 className="section-title">Price Changes</h4>
          <div className="metrics-grid">
            {priceChange7d !== undefined && priceChangePercentage7d !== undefined && (
              <div className="metric">
                <label>7 Days</label>
                <div className={`price-change ${priceChangePercentage7d >= 0 ? 'positive' : 'negative'}`}>
                  <span className="change-amount">
                    {priceChangePercentage7d >= 0 ? '+' : ''}{formatCurrency(priceChange7d)}
                  </span>
                  <span className="change-percentage">
                    ({priceChangePercentage7d >= 0 ? '+' : ''}{formatPercentage(priceChangePercentage7d)})
                  </span>
                </div>
              </div>
            )}

            {priceChange30d !== undefined && priceChangePercentage30d !== undefined && (
              <div className="metric">
                <label>30 Days</label>
                <div className={`price-change ${priceChangePercentage30d >= 0 ? 'positive' : 'negative'}`}>
                  <span className="change-amount">
                    {priceChangePercentage30d >= 0 ? '+' : ''}{formatCurrency(priceChange30d)}
                  </span>
                  <span className="change-percentage">
                    ({priceChangePercentage30d >= 0 ? '+' : ''}{formatPercentage(priceChangePercentage30d)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(totalSupply || circulatingSupply || maxSupply) && (
        <div className="metrics-section">
          <h4 className="section-title">Supply Information</h4>
          <div className="metrics-grid">
            {circulatingSupply && (
              <div className="metric">
                <label>Circulating Supply</label>
                <span className="metric-value">{formatSupply(circulatingSupply)}</span>
              </div>
            )}

            {totalSupply && (
              <div className="metric">
                <label>Total Supply</label>
                <span className="metric-value">{formatSupply(totalSupply)}</span>
              </div>
            )}

            {maxSupply && (
              <div className="metric">
                <label>Max Supply</label>
                <span className="metric-value">{formatSupply(maxSupply)}</span>
              </div>
            )}

            {circulatingSupply && maxSupply && (
              <div className="metric supply-progress">
                <label>Supply Progress</label>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${(circulatingSupply / maxSupply) * 100}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {formatPercentage((circulatingSupply / maxSupply) * 100)} circulating
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetMetrics;