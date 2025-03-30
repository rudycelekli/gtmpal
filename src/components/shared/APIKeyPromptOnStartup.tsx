import React, { useEffect, useState } from "react"
import APIKeyModal from "./APIKeyModal"

/**
 * Component that listens for API key missing events and automatically
 * shows the API key modal when the app starts and no API key is found
 */
const APIKeyPromptOnStartup: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Check for API key on mount
    const checkApiKey = async () => {
      try {
        const response = await window.electronAPI.getOpenAIApiKey()
        if (!response.success || !response.apiKey) {
          setShowModal(true)
        }
      } catch (error) {
        console.error("Error checking for API key:", error)
      }
    }
    
    checkApiKey()

    // Also listen for API key missing events
    const cleanup = window.electronAPI.onApiKeyMissing(() => {
      setShowModal(true)
    })

    return () => {
      cleanup()
    }
  }, [])

  // When modal closes, check if we now have a valid key
  const handleModalClose = () => {
    setShowModal(false)
  }

  return (
    <>
      {/* Hidden button to trigger modal */}
      <button 
        ref={setButtonRef}
        className="hidden"
        aria-hidden="true"
      >
        Open API Key Modal
      </button>

      {/* API Key Modal with dynamic trigger */}
      {buttonRef && showModal && (
        <APIKeyModal 
          trigger={buttonRef} 
          onClose={handleModalClose}
        />
      )}
    </>
  )
}

export default APIKeyPromptOnStartup 