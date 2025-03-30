// ipcHandlers.ts

import { ipcMain, shell } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import path from "path"

// Initialize store with async function
let store: any = null;

// Initialize store function - using a different pattern to load ESM modules in CommonJS
async function initializeStore() {
  try {
    // Use a simpler approach - store the API key in a JSON file
    const fs = await import('fs/promises');
    const userDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' ? 
        path.join(process.env.HOME || '', 'Library', 'Application Support') : 
        path.join(process.env.HOME || '', '.config'));
    
    const configPath = path.join(userDataPath, 'interview-coder-v1', 'config.json');
    
    // Create a simple wrapper for our store
    store = {
      get: async (key: string) => {
        try {
          // Check if config file exists
          try {
            await fs.access(configPath);
          } catch (error) {
            // Make sure directory exists
            await fs.mkdir(path.dirname(configPath), { recursive: true });
            // Create empty config
            await fs.writeFile(configPath, JSON.stringify({}), 'utf8');
            return undefined;
          }
          
          // Read the file
          const data = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(data || '{}');
          return config[key];
        } catch (error) {
          console.error(`Error getting ${key} from config:`, error);
          return undefined;
        }
      },
      set: async (key: string, value: any) => {
        try {
          // Make sure directory exists
          await fs.mkdir(path.dirname(configPath), { recursive: true });
          
          // Read current config
          let config = {};
          try {
            const data = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(data || '{}');
          } catch (error) {
            // Ignore if file doesn't exist yet
          }
          
          // Update the value
          config = { ...config, [key]: value };
          
          // Save back to file
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
          return true;
        } catch (error) {
          console.error(`Error setting ${key} in config:`, error);
          return false;
        }
      }
    };
    
    return true;
  } catch (error) {
    console.error("Error initializing config store:", error);
    return false;
  }
}

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")
  
  // Initialize store
  initializeStore().catch(err => console.error("Failed to initialize store:", err));

  // API Key handlers
  ipcMain.handle("get-openai-api-key", async () => {
    try {
      if (!store) {
        await initializeStore();
        if (!store) {
          return { success: false, error: "Store not initialized" };
        }
      }
      
      const apiKey = await store.get('openai-api-key');
      const model = await store.get('openai-model') || 'gpt-4o'; // Default to gpt-4o
      
      if (!apiKey) {
        return { success: false, error: "API key not found" };
      }
      
      return { success: true, apiKey, model };
    } catch (error) {
      console.error("Error getting API key:", error);
      return { success: false, error: "Failed to retrieve API key" };
    }
  });

  ipcMain.handle("set-openai-api-key", async (_event, apiKey: string) => {
    try {
      if (!store) {
        await initializeStore();
        if (!store) {
          return { success: false, error: "Store not initialized" };
        }
      }
      
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return { success: false, error: "Invalid API key" };
      }
      
      // Store the API key
      await store.set('openai-api-key', apiKey.trim());
      
      // Set it in environment for current session
      process.env.OPENAI_API_KEY = apiKey.trim();
      process.env.VITE_OPEN_AI_API_KEY = apiKey.trim();
      
      // Notify that the API key has been updated
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("api-key-updated");
      }
      
      return { success: true };
    } catch (error) {
      console.error("Error setting API key:", error);
      return { success: false, error: "Failed to save API key" };
    }
  });

  // New handler for model configuration
  ipcMain.handle("set-model-config", async (_event, config: { apiKey: string; model: string }) => {
    try {
      if (!store) {
        await initializeStore();
        if (!store) {
          return { success: false, error: "Store not initialized" };
        }
      }
      
      const { apiKey, model } = config;
      
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return { success: false, error: "Invalid API key" };
      }
      
      if (!model || typeof model !== 'string') {
        return { success: false, error: "Invalid model selection" };
      }
      
      // Store the configuration
      await store.set('openai-api-key', apiKey.trim());
      await store.set('openai-model', model);
      
      // Set them in environment for current session
      process.env.OPENAI_API_KEY = apiKey.trim();
      process.env.VITE_OPEN_AI_API_KEY = apiKey.trim();
      process.env.OPENAI_MODEL = model;
      
      console.log(`Configured with model: ${model}`);
      
      // Notify that the config has been updated
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("api-key-updated");
      }
      
      return { success: true };
    } catch (error) {
      console.error("Error setting model configuration:", error);
      return { success: false, error: "Failed to save configuration" };
    }
  });

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    // No need to decrement credits since we're bypassing the credit system
    return
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      return { success: true, path: screenshotPath }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { success: false, error: String(error) }
    }
  })

  // Cancel processing handler
  ipcMain.handle("cancel-processing", () => {
    deps.processingHelper?.cancelProcessing()
    return { success: true }
  })

  // External link handler
  ipcMain.handle("open-external-link", async (event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error("Error opening external link:", error)
      return { success: false, error: String(error) }
    }
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })
}
