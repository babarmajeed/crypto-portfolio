import React from 'react';
import { SentimentAnalysis } from '../../types/news.types';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

interface SentimentIndicatorProps {
  sentiment: SentimentAnalysis;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showScore?: boolean;
  showIcon?: boolean;
  className?: string;
}

export const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({
  sentiment,
  size = 'md',
  showLabel = false,
  showScore = false,
  showIcon = true,
  className = ''
}) => {
  const getSentimentColor = () => {
    switch (sentiment.label) {
      case 'positive':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-800 dark:text-green-300',
          border: 'border-green-200 dark:border-green-700',
          icon: 'text-green-600 dark:text-green-400'
        };
      case 'negative':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-300',
          border: 'border-red-200 dark:border-red-700',
          icon: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-800 dark:text-gray-300',
          border: 'border-gray-200 dark:border-gray-600',
          icon: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return {
          container: 'px-1.5 py-0.5 text-xs',
          icon: 'h-3 w-3',
          gap: 'space-x-1'
        };
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          gap: 'space-x-1'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          gap: 'space-x-2'
        };
      default: // md
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          gap: 'space-x-1.5'
        };
    }
  };

  const getSentimentIcon = () => {
    switch (sentiment.label) {
      case 'positive':
        return <FiTrendingUp className={`${sizeClasses.icon} ${colors.icon}`} />;
      case 'negative':
        return <FiTrendingDown className={`${sizeClasses.icon} ${colors.icon}`} />;
      default:
        return <FiMinus className={`${sizeClasses.icon} ${colors.icon}`} />;
    }
  };

  const formatScore = (score: number): string => {
    const percentage = Math.round(Math.abs(score) * 100);
    const direction = score > 0 ? '+' : score < 0 ? '-' : '';
    return `${direction}${percentage}%`;
  };

  const getSentimentLabel = (): string => {
    switch (sentiment.label) {
      case 'positive':
        return 'Positive';
      case 'negative':
        return 'Negative';
      default:
        return 'Neutral';
    }
  };

  const getEmotionIndicator = () => {
    if (!sentiment.emotions) return null;

    const { fear, greed, optimism, uncertainty } = sentiment.emotions;
    const dominantEmotion = Math.max(fear || 0, greed || 0, optimism || 0, uncertainty || 0);
    
    if (dominantEmotion === 0) return null;

    let emotionLabel = '';
    let emotionIcon = '';
    
    if (dominantEmotion === fear) {
      emotionLabel = 'Fear';
      emotionIcon = '😰';
    } else if (dominantEmotion === greed) {
      emotionLabel = 'Greed';
      emotionIcon = '💰';
    } else if (dominantEmotion === optimism) {
      emotionLabel = 'Optimism';
      emotionIcon = '😊';
    } else if (dominantEmotion === uncertainty) {
      emotionLabel = 'Uncertainty';
      emotionIcon = '🤔';
    }

    return { label: emotionLabel, icon: emotionIcon, score: dominantEmotion };
  };

  const colors = getSentimentColor();
  const sizeClasses = getSizeClasses();
  const emotionInfo = getEmotionIndicator();

  return (
    <div className={`inline-flex items-center ${sizeClasses.gap} ${sizeClasses.container} ${colors.bg} ${colors.border} border rounded-full font-medium ${colors.text} ${className}`}>
      {showIcon && getSentimentIcon()}
      
      {showLabel && (
        <span className="capitalize">
          {getSentimentLabel()}
        </span>
      )}
      
      {showScore && (
        <span className="font-mono">
          {formatScore(sentiment.score)}
        </span>
      )}

      {/* Confidence indicator */}
      {sentiment.confidence > 0 && size !== 'xs' && (
        <div 
          className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60"
          style={{ opacity: sentiment.confidence }}
          title={`Confidence: ${Math.round(sentiment.confidence * 100)}%`}
        />
      )}

      {/* Emotion indicator */}
      {emotionInfo && size === 'lg' && (
        <span 
          className="text-xs opacity-75"
          title={`${emotionInfo.label}: ${Math.round(emotionInfo.score * 100)}%`}
        >
          {emotionInfo.icon}
        </span>
      )}
    </div>
  );
};

// Alternative component for more detailed sentiment display
export const DetailedSentimentIndicator: React.FC<{
  sentiment: SentimentAnalysis;
  className?: string;
}> = ({ sentiment, className = '' }) => {
  const colors = {
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#6b7280'
  };

  const getBarWidth = () => {
    return Math.abs(sentiment.score) * 100;
  };

  const getEmotionBars = () => {
    if (!sentiment.emotions) return null;

    const emotions = [
      { name: 'Fear', value: sentiment.emotions.fear || 0, color: '#ef4444', icon: '😰' },
      { name: 'Greed', value: sentiment.emotions.greed || 0, color: '#f59e0b', icon: '💰' },
      { name: 'Optimism', value: sentiment.emotions.optimism || 0, color: '#22c55e', icon: '😊' },
      { name: 'Uncertainty', value: sentiment.emotions.uncertainty || 0, color: '#6b7280', icon: '🤔' }
    ];

    return emotions.filter(emotion => emotion.value > 0);
  };

  const emotionBars = getEmotionBars();

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Main sentiment */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <SentimentIndicator
            sentiment={sentiment}
            size="sm"
            showIcon
            showLabel
          />
          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
            {(sentiment.score * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Confidence: {Math.round(sentiment.confidence * 100)}%
        </div>
      </div>

      {/* Sentiment bar */}
      <div className="mb-3">
        <div className="flex h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              sentiment.label === 'positive' ? 'bg-green-500' : 
              sentiment.label === 'negative' ? 'bg-red-500' : 'bg-gray-400'
            }`}
            style={{ width: `${getBarWidth()}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      </div>

      {/* Emotion breakdown */}
      {emotionBars && emotionBars.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Emotional Analysis
          </div>
          
          {emotionBars.map((emotion) => (
            <div key={emotion.name} className="flex items-center space-x-2">
              <span className="text-sm">{emotion.icon}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 w-16">
                {emotion.name}
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${emotion.value * 100}%`,
                    backgroundColor: emotion.color
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
                {Math.round(emotion.value * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Keywords */}
      {sentiment.keywords && sentiment.keywords.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Key Sentiment Words
          </div>
          <div className="flex flex-wrap gap-1">
            {sentiment.keywords.slice(0, 5).map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentIndicator;