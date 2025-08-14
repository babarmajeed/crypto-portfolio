import { useState, useEffect, useCallback } from 'react';

interface OfflineStorageConfig {
  dbName: string;
  version: number;
  stores: {
    name: string;
    keyPath?: string;
    autoIncrement?: boolean;
    indices?: { name: string; keyPath: string; unique?: boolean }[];
  }[];
}

interface StoredData<T = any> {
  id: string;
  data: T;
  timestamp: number;
  synced: boolean;
}

interface UseOfflineStorageReturn<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  store: (data: T, id?: string) => Promise<string>;
  retrieve: (id: string) => Promise<T | null>;
  retrieveAll: () => Promise<T[]>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  sync: (syncFn: (data: T[]) => Promise<void>) => Promise<void>;
  getPendingSync: () => Promise<T[]>;
  markSynced: (id: string) => Promise<void>;
}

const defaultConfig: OfflineStorageConfig = {
  dbName: 'CryptoPortfolioDB',
  version: 1,
  stores: [
    {
      name: 'portfolio',
      keyPath: 'id',
      autoIncrement: false,
      indices: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'synced', keyPath: 'synced' }
      ]
    },
    {
      name: 'transactions',
      keyPath: 'id',
      autoIncrement: false,
      indices: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'synced', keyPath: 'synced' }
      ]
    },
    {
      name: 'markets',
      keyPath: 'id',
      autoIncrement: false,
      indices: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'symbol', keyPath: 'data.symbol' }
      ]
    },
    {
      name: 'pendingData',
      keyPath: 'key',
      autoIncrement: false
    }
  ]
};

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private config: OfflineStorageConfig;

  constructor(config: OfflineStorageConfig = defaultConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        this.config.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement
            });

            storeConfig.indices?.forEach(index => {
              store.createIndex(index.name, index.keyPath, { unique: index.unique });
            });
          }
        });
      };
    });
  }

  async store<T>(storeName: string, data: T, id?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const generatedId = id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const storedData: StoredData<T> = {
      id: generatedId,
      data,
      timestamp: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(storedData);

      request.onsuccess = () => resolve(generatedId);
      request.onerror = () => reject(request.error);
    });
  }

  async retrieve<T>(storeName: string, id: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredData<T> | undefined;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async retrieveAll<T>(storeName: string): Promise<StoredData<T>[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as StoredData<T>[]);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(storeName: string, id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSync<T>(storeName: string): Promise<StoredData<T>[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onsuccess = () => resolve(request.result as StoredData<T>[]);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(storeName: string, id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result as StoredData<any>;
        if (data) {
          data.synced = true;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

// Global storage instance
let storageInstance: OfflineStorage | null = null;

const getStorage = async (): Promise<OfflineStorage> => {
  if (!storageInstance) {
    storageInstance = new OfflineStorage();
    await storageInstance.init();
  }
  return storageInstance;
};

export const useOfflineStorage = <T = any>(storeName: string): UseOfflineStorageReturn<T> => {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const storage = await getStorage();
        const storedData = await storage.retrieveAll<T>(storeName);
        setData(storedData.map(item => item.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [storeName]);

  // Store data
  const store = useCallback(async (data: T, id?: string): Promise<string> => {
    try {
      const storage = await getStorage();
      const generatedId = await storage.store(storeName, data, id);
      
      // Update local state
      setData(prev => {
        const existingIndex = prev.findIndex((item: any) => item.id === generatedId);
        if (existingIndex >= 0) {
          const newData = [...prev];
          newData[existingIndex] = data;
          return newData;
        } else {
          return [...prev, data];
        }
      });
      
      return generatedId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store data');
      throw err;
    }
  }, [storeName]);

  // Retrieve single item
  const retrieve = useCallback(async (id: string): Promise<T | null> => {
    try {
      const storage = await getStorage();
      return await storage.retrieve<T>(storeName, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve data');
      return null;
    }
  }, [storeName]);

  // Retrieve all items
  const retrieveAll = useCallback(async (): Promise<T[]> => {
    try {
      const storage = await getStorage();
      const storedData = await storage.retrieveAll<T>(storeName);
      const result = storedData.map(item => item.data);
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve data');
      return [];
    }
  }, [storeName]);

  // Remove item
  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      const storage = await getStorage();
      await storage.remove(storeName, id);
      
      // Update local state
      setData(prev => prev.filter((item: any) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove data');
      throw err;
    }
  }, [storeName]);

  // Clear all data
  const clear = useCallback(async (): Promise<void> => {
    try {
      const storage = await getStorage();
      await storage.clear(storeName);
      setData([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
      throw err;
    }
  }, [storeName]);

  // Sync with server
  const sync = useCallback(async (syncFn: (data: T[]) => Promise<void>): Promise<void> => {
    try {
      const storage = await getStorage();
      const pendingData = await storage.getPendingSync<T>(storeName);
      
      if (pendingData.length > 0) {
        await syncFn(pendingData.map(item => item.data));
        
        // Mark all as synced
        await Promise.all(
          pendingData.map(item => storage.markSynced(storeName, item.id))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync data');
      throw err;
    }
  }, [storeName]);

  // Get pending sync data
  const getPendingSync = useCallback(async (): Promise<T[]> => {
    try {
      const storage = await getStorage();
      const pendingData = await storage.getPendingSync<T>(storeName);
      return pendingData.map(item => item.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get pending sync data');
      return [];
    }
  }, [storeName]);

  // Mark item as synced
  const markSynced = useCallback(async (id: string): Promise<void> => {
    try {
      const storage = await getStorage();
      await storage.markSynced(storeName, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as synced');
      throw err;
    }
  }, [storeName]);

  return {
    data,
    isLoading,
    error,
    store,
    retrieve,
    retrieveAll,
    remove,
    clear,
    sync,
    getPendingSync,
    markSynced
  };
};

export default useOfflineStorage;