import { type MutableRefObject, useCallback, useRef } from 'react'
import type { TerminalHandle } from '@/components/Terminal'
import { useFileUpload } from '@/lib/hooks/use-file-upload'

interface UseTerminalActionHandlersParams {
  terminalRefs: MutableRefObject<Map<string, TerminalHandle | null>>
  activeSessionId: string | null
  showCleaner: boolean
  setShowCleaner: (show: boolean) => void
  setCleanerRawPrompt: (prompt: string) => void
  // Voice input
  setShowVoice: (show: boolean) => void
  voiceStartListening: () => void
  voiceStopListening: () => void
  voiceResetTranscript: () => void
  voiceStatus: 'idle' | 'listening' | 'processing' | 'error'
}

export function useTerminalActionHandlers({
  terminalRefs,
  activeSessionId,
  setShowCleaner,
  setCleanerRawPrompt,
  setShowVoice,
  voiceStartListening,
  voiceStopListening,
  voiceResetTranscript,
  voiceStatus,
}: UseTerminalActionHandlersParams) {
  // File upload functionality
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    uploadFile,
    progress,
    isUploading,
    error: uploadError,
  } = useFileUpload()

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(
    async (file: File) => {
      const result = await uploadFile(file)
      if (result && activeSessionId) {
        // Insert path at cursor in the active terminal
        const terminalRef = terminalRefs.current.get(activeSessionId)
        if (terminalRef) {
          terminalRef.sendInput(result.path)
        }
      }
    },
    [uploadFile, activeSessionId, terminalRefs],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [handleFileSelect],
  )

  // Prompt cleaner handlers
  const handleCleanClick = useCallback(() => {
    if (!activeSessionId) return
    const terminalRef = terminalRefs.current.get(activeSessionId)
    if (!terminalRef) return
    const input = terminalRef.getLastLine()
    if (!input.trim()) return
    setCleanerRawPrompt(input)
    setShowCleaner(true)
  }, [activeSessionId, terminalRefs, setCleanerRawPrompt, setShowCleaner])

  const handleCleanerSend = useCallback(
    (cleanedPrompt: string) => {
      if (!activeSessionId) return
      const terminalRef = terminalRefs.current.get(activeSessionId)
      if (terminalRef) {
        // Clear current line (send Ctrl+U) then send cleaned prompt
        terminalRef.sendInput('\x15') // Ctrl+U
        terminalRef.sendInput(cleanedPrompt)
      }
      setShowCleaner(false)
      setCleanerRawPrompt('')
    },
    [activeSessionId, terminalRefs, setShowCleaner, setCleanerRawPrompt],
  )

  const handleCleanerCancel = useCallback(() => {
    setShowCleaner(false)
    setCleanerRawPrompt('')
  }, [setShowCleaner, setCleanerRawPrompt])

  // Voice input handlers
  const handleVoiceOpen = useCallback(() => {
    setShowVoice(true)
    voiceStartListening()
  }, [setShowVoice, voiceStartListening])

  const handleVoiceSend = useCallback(
    (text: string) => {
      if (!activeSessionId) return
      const terminalRef = terminalRefs.current.get(activeSessionId)
      if (terminalRef) {
        // Send text first, then Enter separately so TUI apps (Claude Code, etc.)
        // don't treat the whole thing as a paste event
        terminalRef.sendInput(text)
        setTimeout(() => terminalRef.sendInput('\r'), 50)
      }
      voiceStopListening()
      voiceResetTranscript()
      setShowVoice(false)
    },
    [activeSessionId, terminalRefs, voiceStopListening, voiceResetTranscript, setShowVoice],
  )

  const handleVoiceInsert = useCallback(
    (text: string) => {
      if (!activeSessionId) return
      const terminalRef = terminalRefs.current.get(activeSessionId)
      if (terminalRef) {
        terminalRef.sendInput(text)
      }
      voiceStopListening()
      voiceResetTranscript()
      setShowVoice(false)
    },
    [activeSessionId, terminalRefs, voiceStopListening, voiceResetTranscript, setShowVoice],
  )

  const handleVoiceCancel = useCallback(() => {
    voiceStopListening()
    voiceResetTranscript()
    setShowVoice(false)
  }, [voiceStopListening, voiceResetTranscript, setShowVoice])

  const handleVoiceToggle = useCallback(() => {
    if (voiceStatus === 'listening') {
      voiceStopListening()
    } else {
      voiceStartListening()
    }
  }, [voiceStatus, voiceStopListening, voiceStartListening])

  return {
    // File upload
    fileInputRef,
    progress,
    isUploading,
    uploadError,
    handleUploadClick,
    handleFileSelect,
    handleFileInputChange,
    // Prompt cleaner
    handleCleanClick,
    handleCleanerSend,
    handleCleanerCancel,
    // Voice input
    handleVoiceOpen,
    handleVoiceSend,
    handleVoiceInsert,
    handleVoiceCancel,
    handleVoiceToggle,
    handleVoiceReset: voiceResetTranscript,
  }
}
