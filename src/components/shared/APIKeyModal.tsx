import React, { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
  DialogClose
} from "../ui/dialog"
import { Input } from "../ui/input"
import { useToast } from "../../contexts/toast"

interface APIKeyModalProps {
  trigger: React.ReactNode
}

const APIKeyModal: React.FC<APIKeyModalProps> = ({ trigger }) => {
  const [apiKey, setApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  // Load the existing API key when the modal opens
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const response = await window.electronAPI.getOpenAIApiKey()
        if (response.success) {
          setApiKey(response.apiKey)
        }
      } catch (error) {
        console.error("Error loading API key:", error)
      }
    }
    loadApiKey()
  }, [])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Validate API key format
      if (apiKey && !apiKey.startsWith('sk-')) {
        showToast("Invalid API Key", "API key should start with 'sk-'", "error")
        setIsLoading(false)
        return
      }

      const response = await window.electronAPI.setOpenAIApiKey(apiKey)
      if (response.success) {
        showToast("Success", "API key saved successfully", "success")
      } else {
        showToast("Error", response.error || "Failed to save API key", "error")
      }
    } catch (error) {
      console.error("Error saving API key:", error)
      showToast("Error", "Failed to save API key", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="bg-black/80 backdrop-blur-md border border-white/10 text-white/90 rounded-lg shadow-xl p-6 max-w-md">
        <DialogTitle className="text-white text-xl font-semibold mb-2">OpenAI API Key</DialogTitle>
        <DialogDescription className="text-white/70 mb-4">
          Enter your OpenAI API key to use your own account. Your key is stored locally and encrypted.
          <br /><br />
          Leave empty to use the default key.
        </DialogDescription>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium text-white/80">
              API Key
            </label>
            <Input
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-md"
            />
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <DialogClose asChild>
              <button 
                className="py-2 px-4 rounded-md text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </DialogClose>
            <DialogClose asChild>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="py-2 px-4 rounded-md bg-blue-600/80 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default APIKeyModal 