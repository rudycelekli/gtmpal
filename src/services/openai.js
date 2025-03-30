import OpenAI from 'openai';

// Create openai instance with default config
let openai = new OpenAI({
  apiKey: '', // Will be set properly later
  timeout: 30000,
  maxRetries: 3,
});

// Initialize API key from electron storage
async function initializeApiKey() {
  try {
    const response = await window.electronAPI.getOpenAIApiKey();
    if (response.success && response.apiKey) {
      // Re-create the client with the proper API key
      openai = new OpenAI({
        apiKey: response.apiKey,
        timeout: 30000,
        maxRetries: 3,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to initialize API key:', error);
    return false;
  }
}

// Initialize key on module load
initializeApiKey();

// Set up listener for API key changes
if (typeof window !== 'undefined' && window.electronAPI) {
  const cleanup = window.electronAPI.onApiKeyUpdated(() => {
    initializeApiKey();
  });
  
  // Cleanup on module unload (not generally used in JS, but good practice)
  if (typeof module !== 'undefined') {
    module.onDisposeCallback = cleanup;
  }
}

// Add error handling wrapper
const callOpenAI = async (fn) => {
  try {
    // Make sure we have the latest API key before making a call
    await initializeApiKey();
    return await fn();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to OpenAI API. Please check your internet connection.');
    }
    
    if (error.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
    }
    
    throw error;
  }
};

export { openai, callOpenAI }; 