import React, { useState } from 'react';
import { AssetCard, AssetCardGrid } from '../AssetCards';
import { setTradeModalHandler } from '../../hooks/useAsset/useAssetActions';
import { toast } from 'react-hot-toast';
import '../../styles/AssetCards.css';

// Mock symbols for demonstration
const MOCK_SYMBOLS = [
  'BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC',
  'SOL', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ICP', 'BCH', 'LTC', 'ALGO', 'VET'
];

interface TradeModalData {
  symbol: string;
  type: 'buy' | 'sell';
}

const AssetCardsExample: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeModalData, setTradeModalData] = useState<TradeModalData | null>(null);

  // Set up trade modal handler
  React.useEffect(() => {
    setTradeModalHandler((data: TradeModalData) => {
      setTradeModalData(data);
      setShowTradeModal(true);
    });
  }, []);

  const handleAssetClick = (symbol: string, assetData: any) => {
    setSelectedAsset(symbol);
    toast.success(`Clicked on ${symbol} - ${assetData.name}`);
    console.log('Asset clicked:', { symbol, assetData });
  };

  const handleCloseTradeModal = () => {
    setShowTradeModal(false);
    setTradeModalData(null);
  };

  const handleExecuteTrade = () => {
    if (tradeModalData) {
      toast.success(`${tradeModalData.type.toUpperCase()} order placed for ${tradeModalData.symbol}`);
      handleCloseTradeModal();
    }
  };

  return (
    <div className="asset-cards-example" style={{ padding: '2rem' }}>
      <div className="example-header" style={{ marginBottom: '2rem' }}>
        <h1>Asset Cards Example</h1>
        <p>Interactive cryptocurrency asset cards with real-time data, charts, and trading actions.</p>
      </div>

      {/* Single Asset Card Examples */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Single Asset Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <AssetCard
            symbol="BTC"
            viewMode="grid"
            onCardClick={handleAssetClick}
            showQuickActions={true}
          />
          <AssetCard
            symbol="ETH"
            viewMode="grid"
            onCardClick={handleAssetClick}
            showQuickActions={true}
          />
        </div>

        <h3>List View</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <AssetCard
            symbol="BTC"
            viewMode="list"
            onCardClick={handleAssetClick}
            showQuickActions={true}
          />
          <AssetCard
            symbol="ETH"
            viewMode="list"
            onCardClick={handleAssetClick}
            showQuickActions={true}
          />
        </div>
      </section>

      {/* Asset Card Grid */}
      <section>
        <h2>Asset Card Grid</h2>
        <AssetCardGrid
          symbols={MOCK_SYMBOLS}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAssetClick={handleAssetClick}
          showViewToggle={true}
          showSearch={true}
          showSort={true}
          showFilter={true}
        />
      </section>

      {/* Trade Modal */}
      {showTradeModal && tradeModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '0.75rem',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3>{tradeModalData.type.toUpperCase()} {tradeModalData.symbol}</h3>
            <p>This would open the trading interface for {tradeModalData.symbol}.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={handleExecuteTrade}
                style={{
                  background: tradeModalData.type === 'buy' ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Execute {tradeModalData.type.toUpperCase()}
              </button>
              <button
                onClick={handleCloseTradeModal}
                style={{
                  background: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Asset Info */}
      {selectedAsset && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          background: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e5e7eb'
        }}>
          <div>Selected: <strong>{selectedAsset}</strong></div>
          <button
            onClick={() => setSelectedAsset(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default AssetCardsExample;