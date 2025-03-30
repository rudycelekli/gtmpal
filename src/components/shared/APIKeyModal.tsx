import React, { useState, useEffect, useRef } from "react"

/**
 * Modal component for entering the OpenAI API key
 */
interface APIKeyModalProps {
  trigger: HTMLElement | null
  onClose: () => void
}

// Define available model options
const MODEL_OPTIONS = [
  { id: 'gpt-4', name: 'GPT-4', description: 'Older but reliable model' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Good balance of quality and speed' },
  { id: 'gpt-4o-mini', name: 'GPT-4o-mini', description: 'Faster but less capable than GPT-4o' },
  { id: 'o1', name: 'O1', description: 'Best reasoning and problem-solving capabilities', default: true },
  { id: 'o1-mini', name: 'O1-mini', description: 'Faster version of O1 with good reasoning' }
];

const APIKeyModal: React.FC<APIKeyModalProps> = ({ trigger, onClose }) => {
  const [apiKey, setApiKey] = useState("")
  const [selectedModel, setSelectedModel] = useState(() => 
    MODEL_OPTIONS.find(model => model.default)?.id || 'o1'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Load current API key and model when the modal opens
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const response = await window.electronAPI.getOpenAIApiKey();
        if (response.success && response.apiKey) {
          // Mask the API key for security, just show that it exists
          setApiKey(response.apiKey);
          
          // Set the current model if available
          if (response.model) {
            setSelectedModel(response.model);
          }
        }
      } catch (error) {
        console.error("Error loading current API configuration:", error);
      }
    };
    
    loadCurrentConfig();
  }, []);

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
      // Save both API key and model
      const result = await window.electronAPI.setModelConfig({
        apiKey: apiKey.trim(),
        model: selectedModel
      })
      
      if (result.success) {
        onClose()
      } else {
        setError(result.error || "Failed to save configuration")
      }
    } catch (err) {
      setError("An error occurred while saving the configuration")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-black/80 backdrop-blur-md rounded-lg shadow-xl p-6 m-4 max-w-md w-full border border-white/10"
      >
        <h2 className="text-xl font-semibold mb-4 text-white/90">
          Configure OpenAI Settings
        </h2>
        
        <p className="text-white/70 mb-6 text-sm">
          Your API key is required to use this application. It will be stored locally on your device and never sent to our servers.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label 
              htmlFor="apiKey" 
              className="block text-sm font-medium text-white/90 mb-2"
            >
              OpenAI API Key
            </label>
            <input
              ref={inputRef}
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2.5 bg-black/40 border border-white/20 rounded-md 
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white
                        placeholder:text-white/40"
              placeholder="sk-..."
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          
          <div>
            <label 
              htmlFor="model" 
              className="block text-sm font-medium text-white/90 mb-2"
            >
              Model
            </label>
            <div className="space-y-2">
              {MODEL_OPTIONS.map(model => (
                <div key={model.id} className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id={`model-${model.id}`}
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={selectedModel === model.id}
                      onChange={() => setSelectedModel(model.id)}
                      className="w-4 h-4 text-blue-600 bg-black/40 border-white/20 focus:ring-blue-500"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor={`model-${model.id}`} className="text-sm font-medium text-white/90">
                      {model.name}
                      {model.default && <span className="ml-2 text-xs bg-blue-600/60 px-2 py-0.5 rounded-full">Recommended</span>}
                    </label>
                    <p className="text-xs text-white/60">{model.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm py-2 px-3 rounded bg-red-900/30 border border-red-800/50">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-white/20 rounded-md text-sm font-medium 
                        text-white/80 hover:bg-white/10 
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
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default APIKeyModal 