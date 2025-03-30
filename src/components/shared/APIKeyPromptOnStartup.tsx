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
    console.log("APIKeyPromptOnStartup mounted");
    
    // Check for API key on mount
    const checkApiKey = async () => {
      try {
        console.log("Checking for API key...");
        const response = await window.electronAPI.getOpenAIApiKey()
        console.log("API key check response:", response);
        
        if (!response.success || !response.apiKey) {
          console.log("No API key found, showing modal");
          setShowModal(true)
        }
      } catch (error) {
        console.error("Error checking for API key:", error)
      }
    }
    
    checkApiKey()

    // Also listen for API key missing events
    console.log("Setting up API key missing listener");
    const cleanup = window.electronAPI.onApiKeyMissing(() => {
      console.log("API key missing event received");
      setShowModal(true)
    })

    return () => {
      console.log("APIKeyPromptOnStartup unmounting");
      cleanup()
    }
  }, [])

  // When modal closes, check if we now have a valid key
  const handleModalClose = () => {
    console.log("API key modal closed");
    setShowModal(false)
  }

  console.log("APIKeyPromptOnStartup rendering, showModal:", showModal, "buttonRef:", !!buttonRef);

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