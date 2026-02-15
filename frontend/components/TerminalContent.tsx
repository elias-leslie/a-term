import { clsx } from 'clsx'
import type { RefObject } from 'react'
import type { TerminalSlot } from '@/lib/utils/slot'
import type { TerminalHandle, ConnectionStatus } from '@/components/terminal.types'
import type {
  TerminalFontId,
  TerminalFontSize,
  TerminalScrollback,
  TerminalCursorStyle,
  TerminalThemeId,
} from '@/lib/hooks/use-terminal-settings'
import type { KeyboardSizePreset } from '@/components/keyboard/types'
import type { PaneLayout } from '@/types/pane-layout'
import type {
  TranscriptionError,
  TranscriptionStatus,
} from '@agent-hub/passport-client'
import { FileUploadDropzone } from './FileUploadDropzone'
import { MobileKeyboard } from './keyboard/MobileKeyboard'
import { PromptCleaner } from './PromptCleaner'
import { SettingsDropdown } from './SettingsDropdown'
import { TerminalLayoutRenderer } from './TerminalLayoutRenderer'
import { UploadErrorToast, UploadProgressToast } from './UploadStatusToast'
import { VoiceTranscriptPanel } from './VoiceTranscriptPanel'

interface TerminalContentProps {
  // Terminal state
  terminalSlots: TerminalSlot[]
  fontFamily: string
  fontSize: TerminalFontSize
  scrollback: TerminalScrollback
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  theme?: Parameters<typeof TerminalLayoutRenderer>[0]['theme']

  // Settings
  fontId: TerminalFontId
  themeId: TerminalThemeId
  showSettings: boolean
  setFontId: (id: TerminalFontId) => void
  setFontSize: (size: TerminalFontSize) => void
  setScrollback: (lines: TerminalScrollback) => void
  setCursorStyle: (style: TerminalCursorStyle) => void
  setCursorBlink: (blink: boolean) => void
  setThemeId: (id: TerminalThemeId) => void
  setShowSettings: (show: boolean) => void
  keyboardSize?: KeyboardSizePreset
  handleKeyboardSizeChange: (size: KeyboardSizePreset) => void
  isMobile?: boolean

  // Handlers
  setTerminalRef: (sessionId: string, handle: TerminalHandle | null) => void
  handleStatusChange: (sessionId: string, status: ConnectionStatus) => void
  onSlotSwitch: (slot: TerminalSlot) => void
  onSlotReset: (slot: TerminalSlot) => void
  onSlotClose: (slot: TerminalSlot) => void
  onSlotClean: (slot: TerminalSlot) => void
  canAddPane: boolean
  handleOpenSettings: () => void
  handleOpenTerminalManager: () => void
  handleUploadClick: () => void
  onModeSwitch: (slot: TerminalSlot, mode: 'shell' | 'claude') => void
  isModeSwitching: boolean
  onSwapPanes: (slotIdA: string, slotIdB: string) => void
  onLayoutChange?: (layouts: PaneLayout[]) => void

  // File upload
  fileInputRef: RefObject<HTMLInputElement | null>
  progress: number
  isUploading: boolean
  uploadError: { message: string } | null
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleFileSelect: (file: File) => void

  // Prompt cleaner
  showCleaner: boolean
  cleanerRawPrompt: string
  handleCleanerSend: (cleaned: string) => void
  handleCleanerCancel: () => void
  cleanPrompt: (prompt: string, refinement?: string) => Promise<string>

  // Mobile keyboard
  sessions: Array<{ id: string }>
  activeStatus?: ConnectionStatus
  handleKeyboardInput: (input: string) => void
  handleReconnect: () => void

  // Voice input
  showVoice: boolean
  isVoiceSupported: boolean
  voiceFinalTranscript: string
  voiceInterimTranscript: string
  voiceStatus: TranscriptionStatus
  voiceError: TranscriptionError
  handleVoiceOpen: () => void
  handleVoiceSend: (text: string) => void
  handleVoiceInsert: (text: string) => void
  handleVoiceCancel: () => void
  handleVoiceToggle: () => void
  handleVoiceReset: () => void

  // Class name
  className?: string
}

/**
 * Renders the terminal content area with all modals and overlays
 * Extracted from TerminalTabs to reduce component size
 */
export function TerminalContent({
  terminalSlots,
  fontFamily,
  fontSize,
  scrollback,
  cursorStyle,
  cursorBlink,
  theme,
  fontId,
  themeId,
  showSettings,
  setFontId,
  setFontSize,
  setScrollback,
  setCursorStyle,
  setCursorBlink,
  setThemeId,
  setShowSettings,
  keyboardSize,
  handleKeyboardSizeChange,
  isMobile,
  setTerminalRef,
  handleStatusChange,
  onSlotSwitch,
  onSlotReset,
  onSlotClose,
  onSlotClean,
  canAddPane,
  handleOpenSettings,
  handleOpenTerminalManager,
  handleUploadClick,
  onModeSwitch,
  isModeSwitching,
  onSwapPanes,
  onLayoutChange,
  fileInputRef,
  progress,
  isUploading,
  uploadError,
  handleFileInputChange,
  handleFileSelect,
  showCleaner,
  cleanerRawPrompt,
  handleCleanerSend,
  handleCleanerCancel,
  cleanPrompt,
  sessions,
  activeStatus,
  handleKeyboardInput,
  handleReconnect,
  showVoice,
  isVoiceSupported,
  voiceFinalTranscript,
  voiceInterimTranscript,
  voiceStatus,
  voiceError,
  handleVoiceOpen,
  handleVoiceSend,
  handleVoiceInsert,
  handleVoiceCancel,
  handleVoiceToggle,
  handleVoiceReset,
  className,
}: TerminalContentProps) {
  return (
    <div className={clsx('flex flex-col h-full min-h-0 overflow-visible', className)}>
      {/* Settings dropdown - all settings controls */}
      <SettingsDropdown
        fontId={fontId}
        fontSize={fontSize}
        scrollback={scrollback}
        cursorStyle={cursorStyle}
        cursorBlink={cursorBlink}
        themeId={themeId}
        setFontId={setFontId}
        setFontSize={setFontSize}
        setScrollback={setScrollback}
        setCursorStyle={setCursorStyle}
        setCursorBlink={setCursorBlink}
        setThemeId={setThemeId}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        keyboardSize={keyboardSize}
        setKeyboardSize={handleKeyboardSizeChange}
        isMobile={isMobile}
        renderTrigger={false}
      />

      {/* Hidden file input for upload button */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        accept="image/*,.md,.txt,.json,.pdf"
      />

      {/* Upload status indicators */}
      {isUploading && <UploadProgressToast progress={progress} />}
      {uploadError && <UploadErrorToast message={uploadError.message} />}

      {/* Terminal panels with drag-drop upload */}
      <FileUploadDropzone
        onFileSelect={handleFileSelect}
        disabled={isUploading}
        className={clsx(
          'flex-1 min-h-0 relative overflow-hidden',
          isMobile ? 'order-1' : 'order-2',
        )}
      >
        <TerminalLayoutRenderer
          terminalSlots={terminalSlots}
          fontFamily={fontFamily}
          fontSize={fontSize}
          scrollback={scrollback}
          cursorStyle={cursorStyle}
          cursorBlink={cursorBlink}
          theme={theme}
          onTerminalRef={setTerminalRef}
          onStatusChange={handleStatusChange}
          onSlotSwitch={onSlotSwitch}
          onSlotReset={onSlotReset}
          onSlotClose={onSlotClose}
          onSlotClean={onSlotClean}
          canAddPane={canAddPane}
          onShowSettings={handleOpenSettings}
          onShowTerminalManager={handleOpenTerminalManager}
          onUploadClick={handleUploadClick}
          onModeSwitch={onModeSwitch}
          isModeSwitching={isModeSwitching}
          isMobile={isMobile ?? false}
          onSwapPanes={onSwapPanes}
          onLayoutChange={onLayoutChange}
          onVoice={isVoiceSupported ? handleVoiceOpen : undefined}
        />
      </FileUploadDropzone>

      {/* Mobile keyboard — hidden when voice panel is active */}
      {isMobile && sessions.length > 0 && activeStatus && !showVoice && (
        <div className="order-3">
          <MobileKeyboard
            onSend={handleKeyboardInput}
            connectionStatus={activeStatus}
            onReconnect={handleReconnect}
            keyboardSize={keyboardSize}
            onVoice={isVoiceSupported ? handleVoiceOpen : undefined}
          />
        </div>
      )}

      {/* Prompt Cleaner Panel */}
      {showCleaner && (
        <PromptCleaner
          rawPrompt={cleanerRawPrompt}
          onSend={handleCleanerSend}
          onCancel={handleCleanerCancel}
          cleanPrompt={cleanPrompt}
          showDiffToggle={true}
        />
      )}

      {/* Voice Input Panel — inline on mobile (order-3, replaces keyboard), overlay on desktop */}
      {showVoice && (
        <VoiceTranscriptPanel
          transcript={voiceFinalTranscript}
          interimTranscript={voiceInterimTranscript}
          status={voiceStatus}
          error={voiceError}
          onSend={handleVoiceSend}
          onInsert={handleVoiceInsert}
          onCancel={handleVoiceCancel}
          onToggleListening={handleVoiceToggle}
          onReset={handleVoiceReset}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
