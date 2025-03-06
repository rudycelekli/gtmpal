import OpenAI from "openai"
import fs from "node:fs"
import { store } from "./store"

export class OpenAIService {
  private openai: OpenAI
  private useDefaultKey: boolean = false
  private hasValidKey: boolean = false

  constructor() {
    // Try to get user's custom API key first
    let userApiKey: string | undefined;
    try {
      userApiKey = store.get("openaiApiKey");
    } catch (error) {
      console.warn("Failed to get API key from store, using default key:", error);
    }
    
    // Fall back to environment variable if no custom key
    let apiKey = userApiKey
    this.useDefaultKey = !userApiKey
    
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY
      if (!apiKey) {
        console.error("No OpenAI API key available - functionality will be limited");
        // Initialize with a dummy key, service will show warnings for operations
        apiKey = "dummy_key_functionality_limited"
        this.hasValidKey = false;
      } else {
        this.hasValidKey = true;
      }
    } else {
      this.hasValidKey = true;
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: 300000,
      maxRetries: 3
    })
  }

  // Check if we have a valid API key
  hasKey(): boolean {
    return this.hasValidKey;
  }

  // Method to update the API key
  updateApiKey(newApiKey?: string) {
    // If newApiKey is provided, use it, otherwise check the store
    let apiKey = newApiKey;
    
    // Only check the store if no key was provided
    if (!apiKey) {
      try {
        apiKey = store.get("openaiApiKey");
      } catch (error) {
        console.warn("Failed to get API key from store:", error);
      }
    }
    
    // If we have an API key, update the openai instance
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        timeout: 300000,
        maxRetries: 3
      })
      this.useDefaultKey = false
      this.hasValidKey = true
      return true
    } else {
      // Fall back to default key if available
      const defaultKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY
      if (defaultKey) {
        this.openai = new OpenAI({
          apiKey: defaultKey,
          timeout: 300000,
          maxRetries: 3
        })
        this.useDefaultKey = true
        this.hasValidKey = true
        return true
      }

      this.hasValidKey = false
      return false
    }
  }

  async extractProblemInfo(
    imageDataList: string[], 
    language: string, 
    signal: AbortSignal,
    model?: string
  ) {
    const base64Images = imageDataList.map(data => 
      `data:image/png;base64,${data}`
    )
    
    const response = await this.openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert programming assistant specializing in technical interview preparation. Your role is to accurately extract programming problem descriptions from screenshots. Ensure you capture all important details including:
- Problem statement and constraints
- Input/output examples
- Edge cases mentioned
- Time and space complexity requirements
- Any hints or special considerations

Format your response using markdown for better readability:
- Use ## headings for main sections
- Use code blocks with proper syntax highlighting for code examples
- Use bullet points for lists
- Use tables where appropriate
- Format important constraints in **bold**

The user's preferred programming language is ${language}, but extract the complete problem regardless of language.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the complete programming problem description from these screenshots:" },
            ...base64Images.map(url => ({
              type: "image_url" as const,
              image_url: { url }
            }))
          ]
        }
      ],
      max_tokens: 4000
    }, {
      signal
    })

    return response.choices[0].message.content
  }

  async generateSolution(
    problemInfo: any, 
    language: string, 
    signal: AbortSignal,
    model?: string
  ) {
    const response = await this.openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert technical interviewer and coding mentor specializing in ${language}. Your task is to create an ideal interview solution that would impress a technical interviewer at a top tech company.

Format your entire response in markdown with the following structure:

## 1. PROBLEM UNDERSTANDING
Briefly restate the problem to demonstrate understanding

## 2. APPROACH DISCUSSION
Explain your thought process and the approaches you considered before arriving at your solution

## 3. SOLUTION WALKTHROUGH
Step-by-step explanation of how you solve the problem, as if explaining to an interviewer

## 4. OPTIMIZED CODE
Well-documented ${language} code with:
\`\`\`${language}
// Clear variable names
// Thorough but concise comments
// Efficiency considerations
\`\`\`

## 5. COMPLEXITY ANALYSIS
Clearly state and explain:
- **Time Complexity**: O(?) - with justification
- **Space Complexity**: O(?) - with justification

## 6. TESTING
Show how you'd test your solution with examples from the problem

## 7. EDGE CASES
Address how your solution handles edge cases

Use proper markdown formatting throughout:
- Code blocks with syntax highlighting
- Bold for important points
- Lists for multiple items
- Tables where appropriate
- Headings and subheadings for organization

Your solution should be professional, clear, and showcase strong problem-solving skills that would impress in a technical interview.
`
        },
        {
          role: "user",
          content: `Solve this programming problem using ${language} and provide a comprehensive interview-style solution:\n\n${JSON.stringify(problemInfo)}`
        }
      ],
      max_tokens: 4000
    }, {
      signal
    })

    // Format the response as expected by the app
    const solutionText = response.choices[0].message.content
    
    // Parse solution text into required components
    const solution = this.parseSolution(solutionText || "")
    
    return solution
  }
  
  private parseSolution(solutionText: string) {
    // Enhanced parsing logic to extract code and analysis
    const codeRegex = /```(?:.*?)\n([\s\S]*?)```/g
    const codeMatches = [...solutionText.matchAll(codeRegex)]
    
    // Extract the solution thoughts (everything before the first code block)
    const thoughts = solutionText.split("```")[0].trim();
    
    // Try to extract time and space complexity with improved regex
    const timeComplexity = this.extractComplexity(solutionText, "time");
    const spaceComplexity = this.extractComplexity(solutionText, "space");
    
    // Create a structured solution object
    return {
      // Extract the code from the first code block, or use a fallback
      code: codeMatches.length > 0 ? codeMatches[0][1] : solutionText,
      
      // Convert the thoughts into an array for display
      thoughts: [
        "# Solution Analysis", 
        thoughts,
        "",
        "# Complexity Analysis",
        `Time Complexity: ${timeComplexity}`,
        `Space Complexity: ${spaceComplexity}`
      ],
      
      time_complexity: timeComplexity,
      space_complexity: spaceComplexity
    }
  }
  
  private extractComplexity(text: string, type: "time" | "space") {
    // Try to match patterns like "Time Complexity: O(n)" or "The time complexity is O(n log n)"
    const patterns = [
      new RegExp(`${type}\\s*complexity\\s*(?:is|:)\\s*[OΘΩ]\\([^)]+\\)`, "i"),
      new RegExp(`the\\s*${type}\\s*complexity\\s*(?:is|:)\\s*[OΘΩ]\\([^)]+\\)`, "i"),
      new RegExp(`[OΘΩ]\\([^)]+\\)\\s*${type}\\s*complexity`, "i"),
      new RegExp(`${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i"),
    ];
    
    // Try each pattern until we find a match
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    // Extract just the O notation if present anywhere
    const bigORegex = new RegExp(`[OΘΩ]\\([^)]+\\)`, "g");
    const bigOMatches = [...text.matchAll(bigORegex)];
    
    if (bigOMatches.length > 0) {
      // If multiple O notations found, try to associate with the right complexity type
      const typeLines = text.split('\n').filter(line => 
        line.toLowerCase().includes(type.toLowerCase()) && 
        line.includes('O(')
      );
      
      if (typeLines.length > 0) {
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Complexity: ${typeLines[0].trim()}`;
      }
      
      // Use the first O notation as fallback
      return `${type.charAt(0).toUpperCase() + type.slice(1)} Complexity: ${bigOMatches[0][0]}`;
    }
    
    return `${type.charAt(0).toUpperCase() + type.slice(1)} complexity not specified`;
  }
} 