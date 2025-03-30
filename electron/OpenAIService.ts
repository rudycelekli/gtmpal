import OpenAI from "openai"
import fs from "node:fs"

export class OpenAIService {
  private openai: OpenAI

  constructor() {
    const openAiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY
    if (!openAiKey) {
      throw new Error("OpenAI API key not found in environment variables")
    }

    this.openai = new OpenAI({
      apiKey: openAiKey,
      timeout: 300000,
      maxRetries: 3
    })
  }

  async extractProblemInfo(imageDataList: string[], language: string, signal: AbortSignal) {
    const base64Images = imageDataList.map(data => 
      `data:image/png;base64,${data}`
    )
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert programming assistant that extracts problem information from screenshots. The user's preferred language is ${language}.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the programming problem description from these screenshots:" },
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
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert programmer. Generate a solution in ${language}.`
        },
        {
          role: "user",
          content: `Solve this programming problem and explain your approach:\n\n${JSON.stringify(problemInfo)}`
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
    // Simple parsing logic - could be enhanced
    const codeRegex = /```(?:.*?)\n([\s\S]*?)```/g
    const codeMatches = [...solutionText.matchAll(codeRegex)]
    
    return {
      code: codeMatches.length > 0 ? codeMatches[0][1] : solutionText,
      thoughts: ["Solution analysis:\n" + solutionText.split("```")[0]],
      time_complexity: this.extractComplexity(solutionText, "time"),
      space_complexity: this.extractComplexity(solutionText, "space")
    }
  }
  
  private extractComplexity(text: string, type: "time" | "space") {
    const regex = new RegExp(`${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i")
    const match = text.match(regex)
    return match ? match[0] : `${type.charAt(0).toUpperCase() + type.slice(1)} complexity not specified`
  }
} 