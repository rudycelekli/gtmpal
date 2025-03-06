import { openai, callOpenAI } from '../services/openai';

async processScreenshot(screenshot) {
  try {
    // Replace the direct API call with our wrapped version
    const result = await callOpenAI(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4-vision-preview",  // Or whatever model you're using
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this screenshot:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${this.getBase64Image(screenshot)}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      });
    });
    
    return result;
  } catch (error) {
    console.error("Processing error details:", {
      message: error.message,
      code: error.code,
      response: error.response,
      retryCount: error.retryCount,
    });
    throw new Error(error.message || "Server error. Please try again.");
  }
} 