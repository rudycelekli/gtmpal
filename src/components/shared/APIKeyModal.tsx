import React, { useState, useEffect, useRef } from "react"

/**
 * Modal component for entering the OpenAI API key
 */
interface APIKeyModalProps {
  trigger: HTMLElement | null
  onClose: () => void
}

const APIKeyModal: React.FC<APIKeyModalProps> = ({ trigger, onClose }) => {
  const [apiKey, setApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus the input when the modal opens
    if (inputRef.current) {
      inputRef.current.focus()
    }

    // Close modal when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!apiKey.trim()) {
      setError("API key cannot be empty")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.setOpenAIApiKey(apiKey.trim())
      if (result.success) {
        onClose()
      } else {
        setError(result.error || "Failed to save API key")
      }
    } catch (err) {
      setError("An error occurred while saving the API key")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 max-w-md w-full"
      >
        <h2 className="text-xl font-semibold mb-4 dark:text-white">
          Enter your OpenAI API Key
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Your API key is required to use this application. It will be stored locally on your device and never sent to our servers.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="apiKey" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              OpenAI API Key
            </label>
            <input
              ref={inputRef}
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md 
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="sk-..."
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium 
                        text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white 
                        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save API Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default APIKeyModal 