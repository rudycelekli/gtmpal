import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Find the .env file
const envPath = path.resolve(process.cwd(), '.env');

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  console.error('.env file not found. Please create one based on .env.example');
  process.exit(1);
}

// Load environment variables
dotenv.config({ path: envPath });

// Validate required environment variables
// No longer enforcing API key from .env file
// Instead we will prompt the user for their own key

export default {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '', // Provide empty default
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.API_MAX_RETRIES || '3', 10),
  }
}; 