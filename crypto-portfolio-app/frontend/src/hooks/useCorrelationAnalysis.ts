import { useState, useEffect, useCallback, useMemo } from 'react';
import { correlationService } from '../services/CorrelationService';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CorrelationPair {
  asset1: string;
  asset2: string;
  correlation: number;
  strength: 'very strong' | 'strong' | 'moderate' | 'weak' | 'very weak';
  direction: 'positive' | 'negative' | 'neutral';
  significance: number;
}

interface RollingCorrelation {
  asset1: string;
  asset2: string;
  data: Array<{ time: number; correlation: number }>;
}

interface CorrelationAnalysisState {
  correlationMatrix: Record<string, Record<string, number>>;
  pairCorrelations: CorrelationPair[];
  rollingCorrelations: RollingCorrelation[];
  topCorrelatedPairs: CorrelationPair[];
  antiCorrelatedPairs: CorrelationPair[];
  clusteredAssets: string[][];
  isCalculating: boolean;
  lastCalculated: number | null;
}

interface UseCorrelationAnalysisOptions {
  multiAssetData: Record<string, CandlestickData[]>;
  rollingWindow?: number;
  minCorrelationThreshold?: number;
  maxAntiCorrelationThreshold?: number;
  enableRollingCorrelation?: boolean;
  updateInterval?: number;
}

export const useCorrelationAnalysis = (options: UseCorrelationAnalysisOptions) => {
  const {
    multiAssetData,
    rollingWindow = 20,
    minCorrelationThreshold = 0.5,
    maxAntiCorrelationThreshold = -0.3,
    enableRollingCorrelation = true,
    updateInterval = 5000
  } = options;

  const [state, setState] = useState<CorrelationAnalysisState>({
    correlationMatrix: {},
    pairCorrelations: [],
    rollingCorrelations: [],
    topCorrelatedPairs: [],
    antiCorrelatedPairs: [],
    clusteredAssets: [],
    isCalculating: false,
    lastCalculated: null
  });

  // Memoized asset list for performance
  const assets = useMemo(() => Object.keys(multiAssetData), [multiAssetData]);

  // Get correlation strength category
  const getCorrelationStrength = useCallback((correlation: number): 'very strong' | 'strong' | 'moderate' | 'weak' | 'very weak' => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'very strong';
    if (abs >= 0.6) return 'strong';
    if (abs >= 0.4) return 'moderate';
    if (abs >= 0.2) return 'weak';
    return 'very weak';
  }, []);

  // Get correlation direction
  const getCorrelationDirection = useCallback((correlation: number): 'positive' | 'negative' | 'neutral' => {
    if (correlation > 0.1) return 'positive';
    if (correlation < -0.1) return 'negative';
    return 'neutral';
  }, []);

  // Calculate correlation matrix and related metrics
  const calculateCorrelations = useCallback(async () => {
    if (assets.length < 2) return;

    setState(prev => ({ ...prev, isCalculating: true }));

    try {
      // Calculate correlation matrix
      const matrix = correlationService.calculateCorrelationMatrix(multiAssetData);
      
      // Generate pair correlations with metadata
      const pairs: CorrelationPair[] = [];
      
      for (let i = 0; i < assets.length; i++) {
        for (let j = i + 1; j < assets.length; j++) {
          const asset1 = assets[i];
          const asset2 = assets[j];
          const correlation = matrix[asset1][asset2];
          
          // Calculate enhanced correlation for significance testing
          const enhancedCorr = correlationService.calculateEnhancedCorrelation(
            multiAssetData[asset1],
            multiAssetData[asset2]
          );
          
          pairs.push({
            asset1,
            asset2,
            correlation,
            strength: getCorrelationStrength(correlation),
            direction: getCorrelationDirection(correlation),
            significance: enhancedCorr.confidence
          });
        }
      }

      // Sort pairs by absolute correlation strength
      const sortedPairs = pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
      
      // Identify top correlated and anti-correlated pairs
      const topCorrelatedPairs = sortedPairs.filter(pair => 
        pair.correlation >= minCorrelationThreshold
      );
      
      const antiCorrelatedPairs = sortedPairs.filter(pair => 
        pair.correlation <= maxAntiCorrelationThreshold
      );

      // Calculate rolling correlations if enabled
      let rollingCorrelations: RollingCorrelation[] = [];
      if (enableRollingCorrelation) {
        rollingCorrelations = pairs.slice(0, 5).map(pair => ({ // Limit to top 5 pairs for performance
          asset1: pair.asset1,
          asset2: pair.asset2,
          data: correlationService.calculateRollingCorrelation(
            multiAssetData[pair.asset1],
            multiAssetData[pair.asset2],
            rollingWindow
          )
        }));
      }

      // Cluster assets by correlation similarity
      const clusteredAssets = clusterAssetsByCorrelation(matrix, assets, 0.6);

      setState(prev => ({
        ...prev,
        correlationMatrix: matrix,
        pairCorrelations: sortedPairs,
        rollingCorrelations,
        topCorrelatedPairs,
        antiCorrelatedPairs,
        clusteredAssets,
        isCalculating: false,
        lastCalculated: Date.now()
      }));

    } catch (error) {
      console.error('Error calculating correlations:', error);
      setState(prev => ({ ...prev, isCalculating: false }));
    }
  }, [
    assets, 
    multiAssetData, 
    minCorrelationThreshold, 
    maxAntiCorrelationThreshold, 
    enableRollingCorrelation, 
    rollingWindow,
    getCorrelationStrength,
    getCorrelationDirection
  ]);

  // Cluster assets by correlation similarity using hierarchical clustering
  const clusterAssetsByCorrelation = useCallback((
    matrix: Record<string, Record<string, number>>,
    assetList: string[],
    threshold: number
  ): string[][] => {
    if (assetList.length < 2) return [assetList];

    const clusters: string[][] = assetList.map(asset => [asset]);
    const distances: number[][] = [];

    // Calculate distance matrix (1 - correlation)
    for (let i = 0; i < assetList.length; i++) {
      distances[i] = [];
      for (let j = 0; j < assetList.length; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else {
          const correlation = matrix[assetList[i]][assetList[j]];
          distances[i][j] = 1 - Math.abs(correlation);
        }
      }
    }

    // Simple hierarchical clustering
    while (clusters.length > 1) {
      let minDistance = Infinity;
      let mergeIndices = [0, 1];

      // Find closest clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const avgDistance = calculateAverageDistance(clusters[i], clusters[j], distances, assetList);
          if (avgDistance < minDistance) {
            minDistance = avgDistance;
            mergeIndices = [i, j];
          }
        }
      }

      // Stop if minimum distance exceeds threshold
      if (minDistance > (1 - threshold)) break;

      // Merge closest clusters
      const [i, j] = mergeIndices;
      const mergedCluster = [...clusters[i], ...clusters[j]];
      
      clusters.splice(j, 1); // Remove second cluster first (higher index)
      clusters.splice(i, 1); // Remove first cluster
      clusters.push(mergedCluster);
    }

    return clusters.filter(cluster => cluster.length > 1); // Return only multi-asset clusters
  }, []);

  // Calculate average distance between two clusters
  const calculateAverageDistance = (
    cluster1: string[], 
    cluster2: string[], 
    distances: number[][], 
    assetList: string[]
  ): number => {
    let totalDistance = 0;
    let count = 0;

    cluster1.forEach(asset1 => {
      cluster2.forEach(asset2 => {
        const i = assetList.indexOf(asset1);
        const j = assetList.indexOf(asset2);
        if (i !== -1 && j !== -1) {
          totalDistance += distances[i][j];
          count++;
        }
      });
    });

    return count > 0 ? totalDistance / count : Infinity;
  };

  // Get correlation for a specific pair
  const getCorrelation = useCallback((asset1: string, asset2: string): number => {
    if (!state.correlationMatrix[asset1] || !state.correlationMatrix[asset2]) {
      return correlationService.calculatePearsonCorrelation(
        multiAssetData[asset1] || [],
        multiAssetData[asset2] || []
      );
    }
    return state.correlationMatrix[asset1][asset2];
  }, [state.correlationMatrix, multiAssetData]);

  // Get pairs with correlation above threshold
  const getHighlyCorrelatedPairs = useCallback((threshold: number = 0.7): CorrelationPair[] => {
    return state.pairCorrelations.filter(pair => Math.abs(pair.correlation) >= threshold);
  }, [state.pairCorrelations]);

  // Get pairs with negative correlation below threshold
  const getNegativelyCorrelatedPairs = useCallback((threshold: number = -0.5): CorrelationPair[] => {
    return state.pairCorrelations.filter(pair => pair.correlation <= threshold);
  }, [state.pairCorrelations]);

  // Find best diversification pairs
  const getDiversificationPairs = useCallback((): CorrelationPair[] => {
    return state.pairCorrelations
      .filter(pair => Math.abs(pair.correlation) < 0.3) // Low correlation
      .sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation))
      .slice(0, 10); // Top 10 most uncorrelated pairs
  }, [state.pairCorrelations]);

  // Find potential arbitrage opportunities (highly correlated but temporarily diverged)
  const getArbitrageOpportunities = useCallback((): Array<{
    pair: CorrelationPair;
    currentDivergence: number;
    rollingCorrelation?: number;
  }> => {
    if (!enableRollingCorrelation) return [];

    return state.rollingCorrelations
      .filter(rolling => rolling.data.length > 0)
      .map(rolling => {
        const pair = state.pairCorrelations.find(p => 
          (p.asset1 === rolling.asset1 && p.asset2 === rolling.asset2) ||
          (p.asset1 === rolling.asset2 && p.asset2 === rolling.asset1)
        );
        
        if (!pair) return null;

        const recentRollingCorr = rolling.data[rolling.data.length - 1]?.correlation || 0;
        const currentDivergence = Math.abs(pair.correlation - recentRollingCorr);

        return {
          pair,
          currentDivergence,
          rollingCorrelation: recentRollingCorr
        };
      })
      .filter(item => item !== null && item.currentDivergence > 0.2) // Significant divergence
      .sort((a, b) => b!.currentDivergence - a!.currentDivergence) as Array<{
        pair: CorrelationPair;
        currentDivergence: number;
        rollingCorrelation?: number;
      }>;
  }, [state.rollingCorrelations, state.pairCorrelations, enableRollingCorrelation]);

  // Calculate portfolio correlation risk
  const calculatePortfolioCorrelationRisk = useCallback((weights: Record<string, number>): {
    averageCorrelation: number;
    maxCorrelation: number;
    diversificationRatio: number;
    riskContribution: Record<string, number>;
  } => {
    const portfolioAssets = Object.keys(weights);
    const correlations: number[] = [];
    let maxCorrelation = 0;
    const riskContribution: Record<string, number> = {};

    // Calculate average correlation and max correlation
    portfolioAssets.forEach(asset1 => {
      riskContribution[asset1] = 0;
      portfolioAssets.forEach(asset2 => {
        if (asset1 !== asset2) {
          const correlation = getCorrelation(asset1, asset2);
          correlations.push(correlation);
          maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
          
          // Risk contribution based on weight and correlation
          riskContribution[asset1] += weights[asset1] * weights[asset2] * Math.abs(correlation);
        }
      });
    });

    const averageCorrelation = correlations.length > 0 
      ? correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length 
      : 0;

    // Simplified diversification ratio calculation
    const weightSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const diversificationRatio = weightSum / Math.sqrt(Object.values(riskContribution).reduce((sum, risk) => sum + risk, 0));

    return {
      averageCorrelation,
      maxCorrelation,
      diversificationRatio,
      riskContribution
    };
  }, [getCorrelation]);

  // Auto-update correlations when data changes
  useEffect(() => {
    if (Object.keys(multiAssetData).length >= 2) {
      calculateCorrelations();
    }
  }, [multiAssetData, calculateCorrelations]);

  // Periodic recalculation for real-time updates
  useEffect(() => {
    if (updateInterval <= 0 || Object.keys(multiAssetData).length < 2) return;

    const interval = setInterval(() => {
      calculateCorrelations();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [calculateCorrelations, updateInterval, multiAssetData]);

  return {
    ...state,
    getCorrelation,
    getHighlyCorrelatedPairs,
    getNegativelyCorrelatedPairs,
    getDiversificationPairs,
    getArbitrageOpportunities,
    calculatePortfolioCorrelationRisk,
    recalculate: calculateCorrelations
  };
};