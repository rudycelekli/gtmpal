// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"

import { ProblemStatementData } from "../types/solutions"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"
import { useToast } from "../contexts/toast"
import { COMMAND_KEY } from "../utils/platform"

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {typeof content === 'string' ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Style paragraphs
              p: ({node, ...props}) => <p className="text-[13px] leading-[1.6] text-gray-100 my-2" {...props} />,
              
              // Style lists
              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
              li: ({node, ...props}) => <li className="text-[13px] text-gray-100" {...props} />,
              
              // Style code blocks and inline code
              code: ({node, inline, className, children, ...props}) => {
                const match = /language-(\w+)/.exec(className || '')
                
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={dracula}
                    language={match[1]}
                    customStyle={{
                      margin: '0.5rem 0',
                      padding: '0.75rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    }}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code
                    className="bg-black/30 px-1 py-0.5 rounded text-[12px] font-mono text-white"
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              
              // Style blockquotes
              blockquote: ({node, ...props}) => (
                <blockquote 
                  className="border-l-2 border-white/20 pl-3 italic text-white/70 my-2"
                  {...props} 
                />
              ),
              
              // Style tables
              table: ({node, ...props}) => (
                <div className="overflow-x-auto my-3">
                  <table className="min-w-full border-collapse text-[12px]" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-white/10" {...props} />,
              tbody: ({node, ...props}) => <tbody className="divide-y divide-white/10" {...props} />,
              tr: ({node, ...props}) => <tr className="divide-x divide-white/10" {...props} />,
              th: ({node, ...props}) => (
                <th 
                  className="px-3 py-2 text-left font-medium text-white/90" 
                  {...props} 
                />
              ),
              td: ({node, ...props}) => (
                <td 
                  className="px-3 py-2 text-left text-white/80" 
                  {...props} 
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          content
        )}
      </div>
    )}
  </div>
)

// Enhanced render function for solution thoughts with proper markdown support
const renderThoughtContent = (thought: string) => {
  // Special case for complexity analysis lines to highlight them
  if (thought.match(/^(Time|Space) Complexity:/i)) {
    return (
      <div className="flex gap-2 items-start my-2">
        <div className="text-indigo-400 font-medium">{thought.split(':')[0]}:</div>
        <div className="text-white/80">{thought.split(':').slice(1).join(':')}</div>
      </div>
    );
  }
  
  // For empty lines, add some spacing
  if (thought.trim() === '') {
    return <div className="h-2"></div>;
  }
  
  // Main heading styles
  if (thought.startsWith('# ') || thought.match(/^[A-Z][A-Z\s]+:$/)) {
    return (
      <h3 className="text-[14px] font-semibold text-white/90 mt-4 mb-2 pb-1 border-b border-white/10">
        {thought.replace(/^#\s*/, '')}
      </h3>
    );
  }
  
  // Render markdown content with custom components for better styling
  return (
    <div className="interview-solution-markdown my-2 text-[13px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style headings
          h1: ({node, ...props}) => <h1 className="text-[16px] font-semibold text-white/90 mt-4 mb-2 pb-1 border-b border-white/10" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-[15px] font-semibold text-white/90 mt-4 mb-2" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-[14px] font-semibold text-white/90 mt-3 mb-2" {...props} />,
          h4: ({node, ...props}) => <h4 className="text-[13px] font-medium text-white/80 mt-2 mb-1" {...props} />,
          h5: ({node, ...props}) => <h5 className="text-[12px] font-medium text-white/80 mt-2 mb-1" {...props} />,
          
          // Style paragraphs
          p: ({node, ...props}) => <p className="text-[13px] leading-[1.6] text-gray-100 my-2" {...props} />,
          
          // Style lists
          ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="text-[13px] text-gray-100" {...props} />,
          
          // Style code blocks and inline code
          code: ({node, inline, className, children, ...props}) => {
            const match = /language-(\w+)/.exec(className || '')
            
            return !inline && match ? (
              <SyntaxHighlighter
                style={dracula}
                language={match[1]}
                customStyle={{
                  margin: '0.5rem 0',
                  padding: '0.75rem',
                  borderRadius: '0.25rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-black/30 px-1 py-0.5 rounded text-[12px] font-mono text-white"
                {...props}
              >
                {children}
              </code>
            )
          },
          
          // Style blockquotes
          blockquote: ({node, ...props}) => (
            <blockquote 
              className="border-l-2 border-white/20 pl-3 italic text-white/70 my-2"
              {...props} 
            />
          ),
          
          // Style tables
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse text-[12px]" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-white/10" {...props} />,
          tbody: ({node, ...props}) => <tbody className="divide-y divide-white/10" {...props} />,
          tr: ({node, ...props}) => <tr className="divide-x divide-white/10" {...props} />,
          th: ({node, ...props}) => (
            <th 
              className="px-3 py-2 text-left font-medium text-white/90" 
              {...props} 
            />
          ),
          td: ({node, ...props}) => (
            <td 
              className="px-3 py-2 text-left text-white/80" 
              {...props} 
            />
          ),
          
          // Style thematic breaks
          hr: ({node, ...props}) => (
            <hr className="border-white/20 my-4" {...props} />
          ),
          
          // Style emphasis
          em: ({node, ...props}) => <em className="italic" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold text-white/90" {...props} />,
          
          // Style links
          a: ({node, ...props}) => (
            <a 
              className="text-blue-400 hover:text-blue-300 hover:underline" 
              target="_blank"
              rel="noopener noreferrer"
              {...props} 
            />
          ),
        }}
      >
        {thought}
      </ReactMarkdown>
    </div>
  );
};

const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide flex justify-between items-center">
      <span>{title}</span>
      <span className="text-[11px] text-white/60 font-normal px-2 py-1 rounded bg-white/10">
        {currentLanguage}
      </span>
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
            Loading solutions...
          </p>
        </div>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 overflow-x-auto">
        <SyntaxHighlighter
          showLineNumbers
          language={currentLanguage === "golang" ? "go" : currentLanguage}
          style={dracula}
          customStyle={{
            maxWidth: "100%",
            margin: 0,
            padding: "1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            backgroundColor: "rgba(22, 27, 34, 0.5)",
            borderRadius: "0.25rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
          }}
          wrapLongLines={true}
          lineProps={(lineNumber) => ({
            style: { 
              display: 'block', 
              width: '100%',
              paddingRight: '1em',
              paddingLeft: '0.5em'
            }
          })}
        >
          {content as string}
        </SyntaxHighlighter>
        <div className="mt-2 text-xs text-white/60 italic">
          Pro tip: You can <span className="font-medium text-white/80">copy, edit and run</span> this code directly.
        </div>
      </div>
    )}
  </div>
)

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      Complexity
    </h2>
    {isLoading ? (
      <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
        Calculating complexity...
      </p>
    ) : (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Time:</strong> {timeComplexity}
          </div>
        </div>
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Space:</strong> {spaceComplexity}
          </div>
        </div>
      </div>
    )}
  </div>
)

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
  currentModel: string
  setModel: (model: string) => void
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage,
  currentModel,
  setModel
}) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)

  interface Screenshot {
    id: string
    path: string
    preview: string
    timestamp: number
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([])

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        console.log("Raw screenshot data:", existing)
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        console.log("Processed screenshots:", screenshots)
        setExtraScreenshots(screenshots)
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        setExtraScreenshots([])
      }
    }

    fetchScreenshots()
  }, [solutionData])

  const { showToast } = useToast()

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots()
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now()
            })
          )
          setExtraScreenshots(screenshots)
        } catch (error) {
          console.error("Error loading extra screenshots:", error)
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true)

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["new_solution"]
        })

        // Reset screenshots
        setExtraScreenshots([])

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
      }),
      window.electronAPI.onProblemExtracted((data) => {
        queryClient.setQueryData(["problem_statement"], data)
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", error, "error")
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
        console.error("Processing error:", error)
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data) => {
        if (!data) {
          console.warn("Received empty or invalid solution data")
          return
        }
        console.log({ data })
        const solutionData = {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity
        }

        queryClient.setQueryData(["solution"], solutionData)
        setSolutionData(solutionData.code || null)
        setThoughtsData(solutionData.thoughts || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots()
            const screenshots =
              existing.previews?.map((p) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now()
              })) || []
            setExtraScreenshots(screenshots)
          } catch (error) {
            console.error("Error loading extra screenshots:", error)
            setExtraScreenshots([])
          }
        }
        fetchScreenshots()
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true)
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data) => {
        queryClient.setQueryData(["new_solution"], data)
        setDebugProcessing(false)
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      }),
      window.electronAPI.onOutOfCredits(() => {
        showToast(
          "Out of Credits",
          "You are out of credits. Please refill at https://www.interviewcoder.co/settings.",
          "error"
        )
      }),
      window.electronAPI.onApiKeyMissing(() => {
        showToast(
          "API Key Missing",
          "No OpenAI API key found. Please add your API key in Settings to continue.",
          "error"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots()
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        setExtraScreenshots(screenshots)
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot", "error")
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
      showToast("Error", "Failed to delete the screenshot", "error")
    }
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : (
        <div ref={contentRef} className="relative space-y-3 px-4 py-3">
          {/* Conditionally render the screenshot queue if solutionData is available */}
          {solutionData && (
            <div className="bg-transparent w-fit">
              <div className="pb-3">
                <div className="space-y-3 w-fit">
                  <ScreenshotQueue
                    isLoading={debugProcessing}
                    screenshots={extraScreenshots}
                    onDeleteScreenshot={handleDeleteExtraScreenshot}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navbar of commands with the SolutionsHelper */}
          <SolutionCommands
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            isProcessing={!problemStatementData || !solutionData}
            extraScreenshots={extraScreenshots}
            credits={credits}
            currentLanguage={currentLanguage}
            setLanguage={setLanguage}
            currentModel={currentModel}
            setModel={setModel}
          />

          {/* Main Content - Modified width constraints */}
          <div className="w-full text-sm text-black bg-black/60 rounded-md">
            <div className="rounded-lg overflow-hidden">
              <div className="px-4 py-3 space-y-4 max-w-full">
                {!solutionData && (
                  <>
                    <ContentSection
                      title="Problem Statement"
                      content={problemStatementData?.problem_statement}
                      isLoading={!problemStatementData}
                    />
                    {problemStatementData && (
                      <div className="mt-4 flex">
                        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                          Generating solutions...
                        </p>
                      </div>
                    )}
                  </>
                )}

                {solutionData && (
                  <>
                    <ContentSection
                      title="Solution Approach"
                      content={
                        <div className="interview-solution">
                          {thoughtsData && (
                            thoughtsData.map((thought, index) => (
                              <React.Fragment key={index}>
                                {renderThoughtContent(thought)}
                              </React.Fragment>
                            ))
                          )}
                        </div>
                      }
                      isLoading={!thoughtsData}
                    />

                    <SolutionSection
                      title="Solution"
                      content={solutionData}
                      isLoading={!solutionData}
                      currentLanguage={currentLanguage}
                    />

                    <ComplexitySection
                      timeComplexity={timeComplexityData}
                      spaceComplexity={spaceComplexityData}
                      isLoading={!timeComplexityData || !spaceComplexityData}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Solutions
