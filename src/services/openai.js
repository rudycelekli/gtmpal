import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add timeout and max retries
  timeout: 30000,
  maxRetries: 3,
});

// Add error handling wrapper
const callOpenAI = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to OpenAI API. Please check your internet connection.');
    }
    throw error;
  }
};

export { openai, callOpenAI }; 