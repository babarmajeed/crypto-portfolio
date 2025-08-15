import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SyncedChartState,
  PanelSyncSettings,
  ChartPanel
} from '../types/chartLayout.types';

interface PanelSyncOptions {
  debounceMs?: number;
  enableCrosshairSync?: boolean;
  enableTimeRangeSync?: boolean;
  enableZoomSync?: boolean;
  enableSymbolSync?: boolean;
  enableTimeframeSync?: boolean;
  masterPanelId?: string;
  syncGroups?: { [panelId: string]: string };
}

interface SyncEvent {
  type: 'timeRange' | 'zoom' | 'crosshair' | 'symbol' | 'timeframe';
  sourcePanel: string;
  data: any;
  timestamp: number;
}

interface UsePanelSyncReturn {
  // Sync state
  isSyncEnabled: boolean;
  syncSettings: PanelSyncSettings;
  syncedState: SyncedChartState;
  masterPanelId: string | null;
  syncGroups: { [panelId: string]: string };
  
  // Sync control
  enableSync: () => void;
  disableSync: () => void;
  toggleSync: () => void;
  updateSyncSettings: (settings: Partial<PanelSyncSettings>) => void;
  
  // Master panel control
  setMasterPanel: (panelId: string | null) => void;
  isMasterPanel: (panelId: string) => boolean;
  
  // Sync groups
  createSyncGroup: (groupName: string, panelIds: string[]) => void;
  addPanelToGroup: (panelId: string, groupName: string) => void;
  removePanelFromGroup: (panelId: string) => void;
  getSyncGroup: (panelId: string) => string | null;
  getPanelsInGroup: (groupName: string) => string[];
  deleteSyncGroup: (groupName: string) => void;
  
  // State updates (called by panels)
  updateTimeRange: (panelId: string, timeRange: SyncedChartState['timeRange']) => void;
  updateZoom: (panelId: string, zoom: SyncedChartState['zoom']) => void;
  updateCrosshair: (panelId: string, crosshair: SyncedChartState['crosshair']) => void;
  updateSymbol: (panelId: string, symbol: string) => void;
  updateTimeframe: (panelId: string, timeframe: string) => void;
  
  // Getters for panels
  getSyncedTimeRange: (panelId: string) => SyncedChartState['timeRange'];
  getSyncedZoom: (panelId: string) => SyncedChartState['zoom'];
  getSyncedCrosshair: (panelId: string) => SyncedChartState['crosshair'];
  getSyncedSymbol: (panelId: string) => string | undefined;
  getSyncedTimeframe: (panelId: string) => string | undefined;
  
  // Sync validation
  canSync: (sourcePanelId: string, targetPanelId: string, syncType: SyncEvent['type']) => boolean;
  shouldSync: (panelId: string, syncType: SyncEvent['type']) => boolean;
  
  // Analytics and debugging
  getSyncHistory: () => SyncEvent[];
  clearSyncHistory: () => void;
  getSyncStats: () => { [type: string]: number };
}

export const usePanelSync = (options: PanelSyncOptions = {}): UsePanelSyncReturn => {
  const {
    debounceMs = 100,
    enableCrosshairSync = true,
    enableTimeRangeSync = true,
    enableZoomSync = true,
    enableSymbolSync = false,
    enableTimeframeSync = false,
    masterPanelId,
    syncGroups: initialSyncGroups = {}
  } = options;

  // State
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [syncSettings, setSyncSettings] = useState<PanelSyncSettings>({
    syncTimeRange: enableTimeRangeSync,
    syncZoom: enableZoomSync,
    syncCrosshair: enableCrosshairSync,
    syncSymbol: enableSymbolSync,
    syncTimeframe: enableTimeframeSync,
    masterPanelId,
    syncGroups: initialSyncGroups
  });
  
  const [syncedState, setSyncedState] = useState<SyncedChartState>({});
  const [syncGroups, setSyncGroups] = useState<{ [panelId: string]: string }>(initialSyncGroups);
  
  // History and analytics
  const [syncHistory, setSyncHistory] = useState<SyncEvent[]>([]);
  const syncStatsRef = useRef<{ [type: string]: number }>({});
  
  // Debouncing
  const debounceTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const lastSyncTimestampRef = useRef<{ [key: string]: number }>({});

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Sync control
  const enableSync = useCallback(() => {
    setIsSyncEnabled(true);
  }, []);

  const disableSync = useCallback(() => {
    setIsSyncEnabled(false);
    setSyncedState({});
    
    // Clear debounce timers
    Object.values(debounceTimersRef.current).forEach(clearTimeout);
    debounceTimersRef.current = {};
  }, []);

  const toggleSync = useCallback(() => {
    if (isSyncEnabled) {
      disableSync();
    } else {
      enableSync();
    }
  }, [isSyncEnabled, enableSync, disableSync]);

  const updateSyncSettings = useCallback((settings: Partial<PanelSyncSettings>) => {
    setSyncSettings(prev => ({
      ...prev,
      ...settings,
      syncGroups: settings.syncGroups ? { ...prev.syncGroups, ...settings.syncGroups } : prev.syncGroups
    }));
    
    // Update local sync groups if they changed
    if (settings.syncGroups) {
      setSyncGroups(prev => ({ ...prev, ...settings.syncGroups }));
    }
  }, []);

  // Master panel control
  const setMasterPanel = useCallback((panelId: string | null) => {
    updateSyncSettings({ masterPanelId: panelId });
  }, [updateSyncSettings]);

  const isMasterPanel = useCallback((panelId: string): boolean => {
    return syncSettings.masterPanelId === panelId;
  }, [syncSettings.masterPanelId]);

  // Sync groups
  const createSyncGroup = useCallback((groupName: string, panelIds: string[]) => {
    const newGroups = { ...syncGroups };
    panelIds.forEach(panelId => {
      newGroups[panelId] = groupName;
    });
    setSyncGroups(newGroups);
    updateSyncSettings({ syncGroups: newGroups });
  }, [syncGroups, updateSyncSettings]);

  const addPanelToGroup = useCallback((panelId: string, groupName: string) => {
    const newGroups = { ...syncGroups, [panelId]: groupName };
    setSyncGroups(newGroups);
    updateSyncSettings({ syncGroups: newGroups });
  }, [syncGroups, updateSyncSettings]);

  const removePanelFromGroup = useCallback((panelId: string) => {
    const newGroups = { ...syncGroups };
    delete newGroups[panelId];
    setSyncGroups(newGroups);
    updateSyncSettings({ syncGroups: newGroups });
  }, [syncGroups, updateSyncSettings]);

  const getSyncGroup = useCallback((panelId: string): string | null => {
    return syncGroups[panelId] || null;
  }, [syncGroups]);

  const getPanelsInGroup = useCallback((groupName: string): string[] => {
    return Object.entries(syncGroups)
      .filter(([_, group]) => group === groupName)
      .map(([panelId]) => panelId);
  }, [syncGroups]);

  const deleteSyncGroup = useCallback((groupName: string) => {
    const newGroups = { ...syncGroups };
    Object.keys(newGroups).forEach(panelId => {
      if (newGroups[panelId] === groupName) {
        delete newGroups[panelId];
      }
    });
    setSyncGroups(newGroups);
    updateSyncSettings({ syncGroups: newGroups });
  }, [syncGroups, updateSyncSettings]);

  // Debounced sync function
  const debouncedSync = useCallback((
    type: SyncEvent['type'],
    sourcePanelId: string,
    data: any,
    immediate = false
  ) => {
    const key = `${type}-${sourcePanelId}`;
    
    // Clear existing timer
    if (debounceTimersRef.current[key]) {
      clearTimeout(debounceTimersRef.current[key]);
    }
    
    const executSync = () => {
      if (!isSyncEnabled || !shouldSync(sourcePanelId, type)) {
        return;
      }
      
      // Update synced state
      setSyncedState(prev => ({
        ...prev,
        [type]: data
      }));
      
      // Add to history
      const syncEvent: SyncEvent = {
        type,
        sourcePanel: sourcePanelId,
        data,
        timestamp: Date.now()
      };
      
      setSyncHistory(prev => {
        const newHistory = [...prev, syncEvent];
        // Keep only last 100 events
        return newHistory.slice(-100);
      });
      
      // Update stats
      syncStatsRef.current[type] = (syncStatsRef.current[type] || 0) + 1;
      
      // Update last sync timestamp
      lastSyncTimestampRef.current[key] = Date.now();
    };
    
    if (immediate || debounceMs === 0) {
      executSync();
    } else {
      debounceTimersRef.current[key] = setTimeout(executSync, debounceMs);
    }
  }, [isSyncEnabled, debounceMs]);

  // State update functions
  const updateTimeRange = useCallback((panelId: string, timeRange: SyncedChartState['timeRange']) => {
    if (syncSettings.syncTimeRange) {
      debouncedSync('timeRange', panelId, timeRange);
    }
  }, [syncSettings.syncTimeRange, debouncedSync]);

  const updateZoom = useCallback((panelId: string, zoom: SyncedChartState['zoom']) => {
    if (syncSettings.syncZoom) {
      debouncedSync('zoom', panelId, zoom);
    }
  }, [syncSettings.syncZoom, debouncedSync]);

  const updateCrosshair = useCallback((panelId: string, crosshair: SyncedChartState['crosshair']) => {
    if (syncSettings.syncCrosshair) {
      // Crosshair updates should be immediate for better UX
      debouncedSync('crosshair', panelId, crosshair, true);
    }
  }, [syncSettings.syncCrosshair, debouncedSync]);

  const updateSymbol = useCallback((panelId: string, symbol: string) => {
    if (syncSettings.syncSymbol) {
      debouncedSync('symbol', panelId, symbol, true);
    }
  }, [syncSettings.syncSymbol, debouncedSync]);

  const updateTimeframe = useCallback((panelId: string, timeframe: string) => {
    if (syncSettings.syncTimeframe) {
      debouncedSync('timeframe', panelId, timeframe, true);
    }
  }, [syncSettings.syncTimeframe, debouncedSync]);

  // Getters for panels
  const getSyncedTimeRange = useCallback((panelId: string): SyncedChartState['timeRange'] => {
    if (!isSyncEnabled || !syncSettings.syncTimeRange) return undefined;
    return syncedState.timeRange;
  }, [isSyncEnabled, syncSettings.syncTimeRange, syncedState.timeRange]);

  const getSyncedZoom = useCallback((panelId: string): SyncedChartState['zoom'] => {
    if (!isSyncEnabled || !syncSettings.syncZoom) return undefined;
    return syncedState.zoom;
  }, [isSyncEnabled, syncSettings.syncZoom, syncedState.zoom]);

  const getSyncedCrosshair = useCallback((panelId: string): SyncedChartState['crosshair'] => {
    if (!isSyncEnabled || !syncSettings.syncCrosshair) return undefined;
    return syncedState.crosshair;
  }, [isSyncEnabled, syncSettings.syncCrosshair, syncedState.crosshair]);

  const getSyncedSymbol = useCallback((panelId: string): string | undefined => {
    if (!isSyncEnabled || !syncSettings.syncSymbol) return undefined;
    return syncedState.symbol;
  }, [isSyncEnabled, syncSettings.syncSymbol, syncedState.symbol]);

  const getSyncedTimeframe = useCallback((panelId: string): string | undefined => {
    if (!isSyncEnabled || !syncSettings.syncTimeframe) return undefined;
    return syncedState.timeframe;
  }, [isSyncEnabled, syncSettings.syncTimeframe, syncedState.timeframe]);

  // Sync validation
  const canSync = useCallback((
    sourcePanelId: string,
    targetPanelId: string,
    syncType: SyncEvent['type']
  ): boolean => {
    if (!isSyncEnabled) return false;
    if (sourcePanelId === targetPanelId) return false;
    
    // Check if sync type is enabled
    const typeKey = `sync${syncType.charAt(0).toUpperCase()}${syncType.slice(1)}` as keyof PanelSyncSettings;
    if (!syncSettings[typeKey]) return false;
    
    // Check master panel restrictions
    if (syncSettings.masterPanelId) {
      return sourcePanelId === syncSettings.masterPanelId;
    }
    
    // Check sync groups
    const sourceGroup = getSyncGroup(sourcePanelId);
    const targetGroup = getSyncGroup(targetPanelId);
    
    if (sourceGroup && targetGroup) {
      return sourceGroup === targetGroup;
    }
    
    // If no groups, allow sync
    return true;
  }, [isSyncEnabled, syncSettings, getSyncGroup]);

  const shouldSync = useCallback((panelId: string, syncType: SyncEvent['type']): boolean => {
    if (!isSyncEnabled) return false;
    
    // Check if sync type is enabled
    const typeKey = `sync${syncType.charAt(0).toUpperCase()}${syncType.slice(1)}` as keyof PanelSyncSettings;
    if (!syncSettings[typeKey]) return false;
    
    // Check master panel restrictions
    if (syncSettings.masterPanelId && syncSettings.masterPanelId !== panelId) {
      return false;
    }
    
    // Check rate limiting
    const key = `${syncType}-${panelId}`;
    const lastSync = lastSyncTimestampRef.current[key];
    if (lastSync && Date.now() - lastSync < 50) { // 50ms minimum between syncs
      return false;
    }
    
    return true;
  }, [isSyncEnabled, syncSettings]);

  // Analytics and debugging
  const getSyncHistory = useCallback((): SyncEvent[] => {
    return [...syncHistory];
  }, [syncHistory]);

  const clearSyncHistory = useCallback(() => {
    setSyncHistory([]);
    syncStatsRef.current = {};
  }, []);

  const getSyncStats = useCallback((): { [type: string]: number } => {
    return { ...syncStatsRef.current };
  }, []);

  return {
    // Sync state
    isSyncEnabled,
    syncSettings,
    syncedState,
    masterPanelId: syncSettings.masterPanelId || null,
    syncGroups,
    
    // Sync control
    enableSync,
    disableSync,
    toggleSync,
    updateSyncSettings,
    
    // Master panel control
    setMasterPanel,
    isMasterPanel,
    
    // Sync groups
    createSyncGroup,
    addPanelToGroup,
    removePanelFromGroup,
    getSyncGroup,
    getPanelsInGroup,
    deleteSyncGroup,
    
    // State updates
    updateTimeRange,
    updateZoom,
    updateCrosshair,
    updateSymbol,
    updateTimeframe,
    
    // Getters
    getSyncedTimeRange,
    getSyncedZoom,
    getSyncedCrosshair,
    getSyncedSymbol,
    getSyncedTimeframe,
    
    // Validation
    canSync,
    shouldSync,
    
    // Analytics
    getSyncHistory,
    clearSyncHistory,
    getSyncStats
  };
};