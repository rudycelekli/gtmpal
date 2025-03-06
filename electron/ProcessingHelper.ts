// ProcessingHelper.ts
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import axios from "axios"
import { app } from "electron"
import { BrowserWindow } from "electron"
import process from "process"
import OpenAI from "openai"

const isDev = !app.isPackaged
const API_BASE_URL = isDev
  ? "http://localhost:3000"
  : "https://www.interviewcoder.co"

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    // Always return a high number of credits
    return 999
  }

  private async getLanguage(): Promise<string> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return "python"

    try {
      await this.waitForInitialization(mainWindow)
      const language = await mainWindow.webContents.executeJavaScript(
        "window.__LANGUAGE__"
      )

      if (
        typeof language !== "string" ||
        language === undefined ||
        language === null
      ) {
        console.warn("Language not properly initialized")
        return "python"
      }

      return language
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(model?: string): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    // Credits check is bypassed - we always have enough credits
    
    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        // Fetch the OpenAI service and update it with the latest API key
        const openAIService = this.deps.getOpenAIService()
        if (openAIService) {
          openAIService.updateApiKey()
          
          // Check if we have a valid API key
          if (!openAIService.hasKey()) {
            // Show API Key Missing warning
            mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_MISSING)
            console.error("No valid OpenAI API key found - aborting processing")
            return
          }
        }

        const screenshots = await Promise.all(
          screenshotQueue.map(async (path) => {
            try {
              const data = await fs.promises.readFile(path, {
                encoding: "base64"
              })
              return { path, data }
            } catch (error) {
              console.error(`Error reading file ${path}:`, error)
              throw error
            }
          })
        )

        // Process screenshots
        await this.processScreenshotsHelper(screenshots, signal, model)
        await this.generateSolutionsHelper(signal, model)

        // Success event
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS, 
          this.deps.getProblemInfo())
      } catch (error) {
        console.error("Error processing screenshots:", error)
        // Error event
        if (error instanceof Error) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Unknown error occurred"
          )
        }
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      if (extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        const screenshots = await Promise.all(
          [
            ...this.screenshotHelper.getScreenshotQueue(),
            ...extraScreenshotQueue
          ].map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64")
          }))
        )
        console.log(
          "Combined screenshots for processing:",
          screenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          screenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal,
    model?: string
  ) {
    const MAX_RETRIES = 0
    let retryCount = 0

    while (retryCount <= MAX_RETRIES) {
      try {
        const imageDataList = screenshots.map((screenshot) => screenshot.data)
        const mainWindow = this.deps.getMainWindow()
        const language = await this.getLanguage()
        let problemInfo

        // First API call - extract problem info using OpenAI Vision model
        const openAiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY
        if (!openAiKey) {
          throw new Error("OpenAI API key not found in environment variables")
        }

        // Initialize OpenAI client directly
        const openai = new OpenAI({
          apiKey: openAiKey,
          timeout: 300000,
          maxRetries: 3
        })

        // First API call - extract problem info using OpenAI Vision model
        const base64Images = imageDataList.map(data => 
          `data:image/png;base64,${data}`
        )
        
        // Direct call to OpenAI API
        const extractResponse = await openai.chat.completions.create({
          model: model || "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert programming assistant that extracts problem information from screenshots."
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

        problemInfo = extractResponse.choices[0].message.content
        
        // Store problem info in AppState
        this.deps.setProblemInfo(problemInfo)

        // Send first success event
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
            problemInfo
          )

          // Generate solutions after successful extraction
          const solutionsResult = await this.generateSolutionsHelper(signal, model)
          if (solutionsResult.success) {
            // Clear any existing extra screenshots before transitioning to solutions view
            this.screenshotHelper.clearExtraScreenshotQueue()
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
              solutionsResult.data
            )
            return { success: true, data: solutionsResult.data }
          } else {
            throw new Error(
              solutionsResult.error || "Failed to generate solutions"
            )
          }
        }
      } catch (error: any) {
        // Log the full error for debugging
        console.error("Processing error details:", {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          retryCount
        })

        // If it's a cancellation or we've exhausted retries, return the error
        if (axios.isCancel(error) || retryCount >= MAX_RETRIES) {
          return { success: false, error: error.message }
        }

        // Increment retry count and continue
        retryCount++
      }
    }

    // If we get here, all retries failed
    return {
      success: false,
      error: "Failed to process after multiple attempts. Please try again."
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal, model?: string) {
    try {
      const problemInfo = this.deps.getProblemInfo()
      const language = await this.getLanguage()
      const openAiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPEN_AI_API_KEY

      if (!openAiKey) {
        throw new Error("OpenAI API key not found in environment variables")
      }

      if (!problemInfo) {
        throw new Error("No problem info available")
      }

      console.log("Generating solutions with problem info:", problemInfo)
      console.log("Using language:", language)
      
      // Instead of making a server call, let's use OpenAI directly like we did for problem extraction
      try {
        // Initialize OpenAI client
        const openai = new OpenAI({
          apiKey: openAiKey,
          timeout: 300000,
          maxRetries: 3
        })
        
        console.log("Making direct OpenAI API call for solution generation...")
        
        const response = await openai.chat.completions.create({
          model: model || "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert programmer. Generate a solution in ${language}.`
            },
            {
              role: "user",
              content: `Solve this programming problem and explain your approach. Include time and space complexity analysis.\n\n${problemInfo}`
            }
          ],
          max_tokens: 4000
        }, {
          signal
        })
        
        console.log("OpenAI API response received for solution generation")
        
        const solutionText = response.choices[0].message.content || ""
        
        // Parse the solution text into the expected format
        const solution = this.parseSolution(solutionText)
        
        console.log("Solution parsed successfully")
        
        return { success: true, data: solution }
      } catch (error) {
        console.error("Direct OpenAI API call error:", error)
        throw error
      }
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow()
      console.error("Solution generation error:", {
        message: error.message,
        code: error.code,
        response: error.response?.data
      })

      // Handle specific error cases (left as they were)
      if (error.code === "ECONNABORTED" || error.response?.status === 504) {
        // Cancel ongoing API requests
        this.cancelOngoingRequests()
        // Clear both screenshot queues
        this.deps.clearQueues()
        // Update view state to queue
        this.deps.setView("queue")
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Request timed out. The server took too long to respond. Please try again."
          )
        }
        return {
          success: false,
          error: "Request timed out. Please try again."
        }
      }

      if (error.response?.data?.error?.includes("API Key out of credits")) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS
          )
        }
        return { success: false, error: error.response.data.error }
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          )
        }
        return { success: false, error: error.response.data.error }
      }

      return { success: false, error: error.message || "Unknown error in solution generation" }
    }
  }

  // Add helper method to parse solution text
  private parseSolution(solutionText: string) {
    // Extract code blocks
    const codeRegex = /```(?:.*?)\n([\s\S]*?)```/g
    const codeMatches = [...solutionText.matchAll(codeRegex)]
    
    // Extract time and space complexity
    const extractComplexity = (text: string, type: "time" | "space") => {
      const regex = new RegExp(`${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`, "i")
      const match = text.match(regex)
      return match ? match[0] : `${type.charAt(0).toUpperCase() + type.slice(1)} complexity not specified`
    }
    
    return {
      code: codeMatches.length > 0 ? codeMatches[0][1] : solutionText,
      thoughts: ["Solution analysis:\n" + solutionText.split("```")[0]],
      time_complexity: extractComplexity(solutionText, "time"),
      space_complexity: extractComplexity(solutionText, "space")
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data)
      const problemInfo = this.deps.getProblemInfo()
      const language = await this.getLanguage()

      if (!problemInfo) {
        throw new Error("No problem info available")
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/debug`,
        { imageDataList, problemInfo, language },
        {
          signal,
          timeout: 300000,
          validateStatus: function (status) {
            return status < 500
          },
          maxRedirects: 5,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )

      return { success: true, data: response.data }
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow()

      // Handle cancellation first
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        }
      }

      if (error.response?.data?.error?.includes("Operation timed out")) {
        // Cancel ongoing API requests
        this.cancelOngoingRequests()
        // Clear both screenshot queues
        this.deps.clearQueues()
        // Update view state to queue
        this.deps.setView("queue")
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Operation timed out after 1 minute. Please try again."
          )
        }
        return {
          success: false,
          error: "Operation timed out after 1 minute. Please try again."
        }
      }

      if (error.response?.data?.error?.includes("API Key out of credits")) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS
          )
        }
        return { success: false, error: error.response.data.error }
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          )
        }
        return { success: false, error: error.response.data.error }
      }

      return { success: false, error: error.message }
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    // Reset hasDebugged flag
    this.deps.setHasDebugged(false)

    // Clear any pending state
    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // Send a clear message that processing was cancelled
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }

  public cancelProcessing(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
    }
    
    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
    }
  }
}
