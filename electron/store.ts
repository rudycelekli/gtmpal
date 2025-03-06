// Import electron-store as an ES module
// We'll create a wrapper around the dynamically imported module

interface StoreSchema {
  openaiApiKey?: string;
}

// Create a placeholder for the store
let store: any = null;

// Initialize the store asynchronously
const initStore = async () => {
  try {
    // Dynamically import electron-store
    const { default: Store } = await import('electron-store');
    
    // Create the store
    store = new Store({
      defaults: {},
      encryptionKey: "your-encryption-key"
    });
    
    console.log('Electron store initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing electron store:', error);
    return false;
  }
};

// Initialize the store immediately
initStore();

// Create a wrapper with the same API but safe to use
const storeWrapper = {
  get: <K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined => {
    if (!store) {
      console.warn('Store not initialized yet');
      return undefined;
    }
    return store.get(key);
  },
  
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void => {
    if (!store) {
      console.warn('Store not initialized yet');
      return;
    }
    store.set(key, value);
  }
};

export { storeWrapper as store, initStore };
