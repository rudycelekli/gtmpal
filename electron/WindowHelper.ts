// electron/WindowHelper.ts

import { BrowserWindow, screen } from "electron"
import { AppState } from "main"
import path from "node:path"
import { IncomingMessage, ServerResponse } from "http"

const isDev = process.env.NODE_ENV === "development"
const isMac = process.platform === "darwin"

// In development, use Vite dev server
// In production, use the built files but ensure OAuth callback server is running
const startUrl = isDev
  ? process.env.VITE_DEV_SERVER_URL || "http://localhost:54321"
  : `file://${path.join(__dirname, "../dist/index.html")}`

// Set up OAuth callback listener in production
if (!isDev) {
  const http = require("http")
  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      if (req.url?.startsWith("/oauth/callback")) {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<script>window.close()</script>")
      } else {
        res.writeHead(404)
        res.end()
      }
    }
  )

  server.listen(54321, "localhost", () => {
    console.log("OAuth callback server listening on port 54321")
  })
}

console.log("Environment:", process.env.NODE_ENV)
console.log("Start URL:", startUrl)

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private isWindowVisible: boolean = false
  private windowPosition: { x: number; y: number } | null = null
  private windowSize: { width: number; height: number } | null = null
  private appState: AppState

  // Initialize with explicit number type and 0 value
  private screenWidth: number = 0
  private screenHeight: number = 0
  private step: number = 0
  private currentX: number = 0
  private currentY: number = 0

  constructor(appState: AppState) {
    this.appState = appState
  }

  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // Get current window position
    const [currentX, currentY] = this.mainWindow.getPosition()

    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize

    // Use 75% width if debugging has occurred, otherwise use 60%
    const maxAllowedWidth = Math.floor(
      workArea.width * (this.appState.getHasDebugged() ? 0.75 : 0.5)
    )

    // Ensure width doesn't exceed max allowed width and height is reasonable
    const newWidth = Math.min(width + 32, maxAllowedWidth)
    const newHeight = Math.ceil(height)

    // Center the window horizontally if it would go off screen
    const maxX = workArea.width - newWidth
    const newX = Math.min(Math.max(currentX, 0), maxX)

    // Update window bounds
    this.mainWindow.setBounds({
      x: newX,
      y: currentY,
      width: newWidth,
      height: newHeight
    })

    // Update internal state
    this.windowPosition = { x: newX, y: currentY }
    this.windowSize = { width: newWidth, height: newHeight }
    this.currentX = newX
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    this.screenWidth = workArea.width
    this.screenHeight = workArea.height

    this.step = Math.floor(this.screenWidth / 10)
    this.currentX = 0

    const preloadPath = path.join(__dirname, "preload.js")
    console.log("Creating window with preload path:", preloadPath)
    console.log("Preload file exists:", require("fs").existsSync(preloadPath))

    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      height: 600,
      minWidth: undefined,
      maxWidth: undefined,
      x: this.currentX,
      y: 0,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        scrollBounce: true // Enable smooth scrolling
      },
      show: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: true,
      alwaysOnTop: true,
      skipTaskbar: true
    }

    this.mainWindow = new BrowserWindow(windowSettings)

    // Enable scrolling and interaction
    this.mainWindow.webContents.setZoomFactor(1)
    this.mainWindow.setIgnoreMouseEvents(false)
    this.mainWindow.setFocusable(true)

    this.mainWindow.setContentProtection(true)
    // this.mainWindow.webContents.openDevTools()

    // Only call macOS specific methods if running on macOS
    if (isMac) {
      this.mainWindow.setHiddenInMissionControl(true)
      this.mainWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      })
    }

    this.mainWindow.setAlwaysOnTop(true, "floating")

    this.mainWindow.loadURL(startUrl).catch((err) => {
      console.error("Failed to load URL:", err)
    })

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.currentX = bounds.x
    this.currentY = bounds.y

    this.setupWindowListeners()
    this.isWindowVisible = true

    this.mainWindow.webContents.on("did-finish-load", () => {
      console.log("Window loaded, checking if electronAPI exists...")
      this.mainWindow.webContents.executeJavaScript(`
        console.log("Window JavaScript context:", {
          hasElectronAPI: !!window.electronAPI,
          apiMethods: window.electronAPI ? Object.keys(window.electronAPI) : [],
          toggleMainWindow: window.electronAPI ? typeof window.electronAPI.toggleMainWindow : 'undefined'
        });
      `)
    })

    // Also add error handler
    this.mainWindow.webContents.on(
      "preload-error",
      (event, preloadPath, error) => {
        console.error("Preload script error:", { preloadPath, error })
      }
    )
  }

  private setupWindowListeners(): void {
    if (!this.mainWindow) return

    this.mainWindow.on("move", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowPosition = { x: bounds.x, y: bounds.y }
        this.currentX = bounds.x
        this.currentY = bounds.y
      }
    })

    this.mainWindow.on("resize", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowSize = { width: bounds.width, height: bounds.height }
      }
    })

    this.mainWindow.on("closed", () => {
      this.mainWindow = null
      this.isWindowVisible = false
      this.windowPosition = null
      this.windowSize = null
    })
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public isVisible(): boolean {
    return this.isWindowVisible
  }

  public hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }

    // First make the window transparent to mouse events
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true })
    this.mainWindow.setFocusable(false)

    // Set opacity to 0 before hiding
    this.mainWindow.setOpacity(0)

    // Hide the window
    this.mainWindow.hide()
    this.isWindowVisible = false
  }

  public showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    const focusedWindow = BrowserWindow.getFocusedWindow()

    if (this.windowPosition && this.windowSize) {
      this.mainWindow.setBounds({
        x: this.windowPosition.x,
        y: this.windowPosition.y,
        width: this.windowSize.width,
        height: this.windowSize.height
      })
    }

    // Make window fully interactive before showing
    this.mainWindow.setIgnoreMouseEvents(false)
    this.mainWindow.setFocusable(true)

    // Show window with initial opacity of 0
    this.mainWindow.setOpacity(0)
    this.mainWindow.show()

    // Fade in the window
    this.mainWindow.setOpacity(1)
    this.mainWindow.showInactive()

    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.focus()
    }

    this.isWindowVisible = true
  }

  public toggleMainWindow(): void {
    if (this.isWindowVisible) {
      this.hideMainWindow()
    } else {
      this.showMainWindow()
    }
  }

  // New methods for window movement
  public moveWindowRight(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.min(
      this.screenWidth - halfWidth,
      this.currentX + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowLeft(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.max(-halfWidth, this.currentX - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowDown(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.min(
      this.screenHeight - halfHeight,
      this.currentY + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowUp(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.max(-halfHeight, this.currentY - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }
}
