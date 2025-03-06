import React from "react"

interface ModelSelectorProps {
  currentModel: string
  setModel: (model: string) => void
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  setModel
}) => {
  const handleModelChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newModel = e.target.value
    try {
      // Update the model locally
      setModel(newModel)
      window.__MODEL__ = newModel
    } catch (error) {
      console.error("Error updating model preference:", error)
    }
  }

  return (
    <div className="mb-3 px-2 space-y-1">
      <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
        <span>Model</span>
        <select
          value={currentModel}
          onChange={handleModelChange}
          className="bg-white/10 rounded px-2 py-1 text-sm outline-none border border-white/10 focus:border-white/20"
          aria-label="Select AI model"
        >
          <option value="gpt4o">GPT-4o</option>
          <option value="o1">OpenAI o1</option>
          <option value="o1-mini">OpenAI o1-mini</option>
          <option value="o3">OpenAI o3</option>
        </select>
      </div>
    </div>
  )
} 