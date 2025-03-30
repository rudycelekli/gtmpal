import OpenAI from "openai"
import fs from "node:fs"

export class OpenAIService {
  private openai: OpenAI
  private model: string

  constructor() {
    const openAiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY
    if (!openAiKey) {
      throw new Error("OpenAI API key not found in environment variables")
    }
    
    // Get model from environment or use default
    this.model = process.env.OPENAI_MODEL || "o1"
    console.log(`Using OpenAI model: ${this.model}`)

    this.openai = new OpenAI({
      apiKey: openAiKey,
      timeout: 300000,
      maxRetries: 3
    })
  }

  // Helper method to determine if using O1 model family
  private isO1Model(): boolean {
    return this.model.startsWith('o1');
  }

  async extractProblemInfo(imageDataList: string[], language: string, signal: AbortSignal) {
    const base64Images = imageDataList.map(data => 
      `data:image/png;base64,${data}`
    )
    
    // Customize system message based on model
    const systemMessage = this.isO1Model() 
      ? `You are an expert programming assistant that extracts clear and concise problem descriptions from screenshots.
      
Extract the programming problem requirements, examples, constraints, and any other relevant information.
Format your response with proper Markdown, including:
- Clean headings
- Organized bullet points
- Code blocks with proper syntax highlighting
- Tables where appropriate

Be thorough but concise. Focus on the most important details and eliminate redundant information.
Ensure all examples and edge cases are included but presented in a clear, structured format.` 
      : `You are an expert programming assistant that extracts clear and complete problem descriptions from screenshots. 
          
Extract the programming problem requirements, examples, constraints, and any other relevant information.
Format your response with proper Markdown, including:
- Clean headings
- Organized bullet points
- Code blocks with proper syntax highlighting
- Tables where appropriate

Be thorough but concise. Ensure all examples and edge cases are included.`;
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract the programming problem description from these screenshots. The user will be solving in ${language}.` },
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

  async generateSolution(problemInfo: any, language: string, signal: AbortSignal) {
    // Customize system message based on model
    const systemMessage = this.isO1Model()
      ? `You are an expert programmer who writes efficient, well-explained solutions.

Your solution must follow this structure:
1. A clear, focused explanation of your approach (1-2 sentences)
2. Clean, well-commented code in ${language}
3. Time and space complexity analysis (Big O notation)

Use proper Markdown for clarity:
- Use headings (## Approach, ## Solution, ## Complexity)
- Format code with proper syntax highlighting
- Keep explanations concise and to the point
- Present complexity analysis clearly

Prioritize readability, efficiency, and accuracy. Focus on the core algorithm and eliminate unnecessary details.`
      : `You are an expert programmer who writes efficient, well-explained solutions.

Your solution must follow this structure:
1. A brief, focused explanation of your approach (2-3 sentences)
2. Clean, well-commented code in ${language}
3. Time and space complexity analysis (Big O notation)
4. Brief explanation of key insights or optimization techniques

Use proper Markdown for clarity:
- Use headings (## Approach, ## Solution, ## Complexity)
- Format code with proper syntax highlighting in code blocks
- Keep explanations concise but thorough
- Present complexity analysis clearly and accurately

Prioritize readability, efficiency, and accuracy.`;
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: `Solve this programming problem with a clear, well-formatted solution in ${language}:\n\n${JSON.stringify(problemInfo)}`
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
    // Improved parsing logic
    const codeRegex = /```(?:.*?)\n([\s\S]*?)```/g
    const codeMatches = [...solutionText.matchAll(codeRegex)]
    
    // Extract approach section (either before the first code block or between ## Approach and the next heading)
    let approach = "";
    if (solutionText.includes("## Approach")) {
      const approachMatch = solutionText.match(/## Approach\s+([\s\S]*?)(?=##|```|$)/);
      approach = approachMatch ? approachMatch[1].trim() : "";
    } else {
      approach = solutionText.split("```")[0].trim();
    }
    
    // Extract complexity information
    const timeComplexity = this.extractComplexity(solutionText, "time");
    const spaceComplexity = this.extractComplexity(solutionText, "space");
    
    return {
      code: codeMatches.length > 0 ? codeMatches[0][1] : "",
      thoughts: [approach.length > 0 ? approach : "Solution approach not specified"],
      time_complexity: timeComplexity,
      space_complexity: spaceComplexity
    }
  }
  
  private extractComplexity(text: string, type: "time" | "space") {
    // Look for complexity in dedicated section first
    const complexityRegex = new RegExp(`## Complexity[\\s\\S]*?${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i");
    const complexityMatch = text.match(complexityRegex);
    
    if (complexityMatch) {
      const lineRegex = new RegExp(`${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i");
      const lineMatch = complexityMatch[0].match(lineRegex);
      return lineMatch ? lineMatch[0] : `${type.charAt(0).toUpperCase() + type.slice(1)} complexity not specified`;
    }
    
    // Fall back to searching the whole text
    const regex = new RegExp(`${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i")
    const match = text.match(regex)
    return match ? match[0] : `${type.charAt(0).toUpperCase() + type.slice(1)} complexity: O(n)` // Default to O(n)
  }
} 