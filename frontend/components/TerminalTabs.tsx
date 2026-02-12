'use client'

import { clsx } from 'clsx'
import { useTerminalOrchestration } from '@/lib/hooks/use-terminal-orchestration'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { TerminalContent } from './TerminalContent'
import { TerminalManagerModal } from './TerminalManagerModal'
import { TerminalSkeleton } from './TerminalSkeleton'

interface TerminalTabsProps {
  projectId?: string
  projectPath?: string
  className?: string
}

export function TerminalTabs({
  projectId,
  projectPath,
  className,
}: TerminalTabsProps) {
  const {
    // Core state
    isLoading,
    sessions,
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
    canAddPane,
    swapPanes,
    activeStatus,
    handleKeyboardInput,
    handleReconnect,
    panes,
    handleAddTab,
    handleNewTerminalForProject,

    // Modal handlers
    showTerminalManager,
    handleOpenTerminalManager,
    handleCloseTerminalManager,
    handleCloseKeyboardHelp,

    // Slot handlers
    handleSlotSwitch,
    handleSlotReset,
    handleSlotClose,
    handleSlotClean,
    handleSlotModeSwitch,
    isModeSwitching,

    // Layout handlers
    handleLayoutChange,

    // Keyboard shortcuts
    showKeyboardHelp,

    // Action handlers
    fileInputRef,
    progress,
    isUploading,
    uploadError,
    handleUploadClick,
    handleFileSelect,
    handleFileInputChange,
    handleCleanerSend,
    handleCleanerCancel,
    cleanPrompt,

    // Prompt cleaner state
    showCleaner,
    cleanerRawPrompt,
  } = useTerminalOrchestration({ projectId, projectPath })

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div className={clsx('flex flex-col h-full min-h-0', className)}>
        <TerminalSkeleton />
      </div>
    )
  }

  return (
    <>
      <TerminalContent
        terminalSlots={terminalSlots}
        fontFamily={fontFamily}
        fontSize={fontSize}
        scrollback={scrollback}
        cursorStyle={cursorStyle}
        cursorBlink={cursorBlink}
        theme={theme}
        fontId={fontId}
        themeId={themeId}
        showSettings={showSettings}
        setFontId={setFontId}
        setFontSize={setFontSize}
        setScrollback={setScrollback}
        setCursorStyle={setCursorStyle}
        setCursorBlink={setCursorBlink}
        setThemeId={setThemeId}
        setShowSettings={setShowSettings}
        keyboardSize={keyboardSize}
        handleKeyboardSizeChange={handleKeyboardSizeChange}
        isMobile={isMobile}
        setTerminalRef={setTerminalRef}
        handleStatusChange={handleStatusChange}
        onSlotSwitch={handleSlotSwitch}
        onSlotReset={handleSlotReset}
        onSlotClose={handleSlotClose}
        onSlotClean={handleSlotClean}
        canAddPane={canAddPane()}
        handleOpenSettings={() => setShowSettings(true)}
        handleOpenTerminalManager={handleOpenTerminalManager}
        handleUploadClick={handleUploadClick}
        onModeSwitch={handleSlotModeSwitch}
        isModeSwitching={!!isModeSwitching}
        onSwapPanes={swapPanes}
        onLayoutChange={handleLayoutChange}
        fileInputRef={fileInputRef}
        progress={progress}
        isUploading={isUploading}
        uploadError={uploadError}
        handleFileInputChange={handleFileInputChange}
        handleFileSelect={handleFileSelect}
        showCleaner={showCleaner}
        cleanerRawPrompt={cleanerRawPrompt}
        handleCleanerSend={handleCleanerSend}
        handleCleanerCancel={handleCleanerCancel}
        cleanPrompt={cleanPrompt}
        sessions={sessions}
        activeStatus={activeStatus}
        handleKeyboardInput={handleKeyboardInput}
        handleReconnect={handleReconnect}
        className={className}
      />

      {/* Terminal Manager Modal */}
      <TerminalManagerModal
        isOpen={showTerminalManager}
        onClose={handleCloseTerminalManager}
        onCreateGenericTerminal={handleAddTab}
        onCreateProjectTerminal={(projectId, rootPath) =>
          handleNewTerminalForProject(projectId, 'shell', rootPath)
        }
        panes={panes}
      />

      {/* Keyboard shortcuts help overlay */}
      <KeyboardShortcuts
        isOpen={showKeyboardHelp}
        onClose={handleCloseKeyboardHelp}
      />
    </>
  )
}
