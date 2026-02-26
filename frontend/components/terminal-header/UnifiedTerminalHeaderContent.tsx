'use client'

import { clsx } from 'clsx'
import { Mic, Paperclip, RefreshCw, Settings, Sparkles, X } from 'lucide-react'
import { memo } from 'react'
import { useAgentTools } from '@/lib/hooks/use-agent-tools'
import { ModeToggle } from '../ModeToggle'
import { PaneOverflowMenu } from '../PaneOverflowMenu'
import { AddTerminalButton } from './AddTerminalButton'
import { HeaderIconButton } from './HeaderIconButton'
import { HeaderNameDisplay } from './HeaderNameDisplay'
import type { UnifiedTerminalHeaderProps } from './types'

export const UnifiedTerminalHeaderContent = memo(
  function UnifiedTerminalHeaderContent({
    slot,
    isActive = false,
    showCleanButton = false,
    onSwitch,
    onSettings,
    onReset,
    onClose,
    onUpload,
    onVoice,
    onClean,
    onOpenModal,
    canAddPane = true,
    onModeSwitch,
    isModeSwitching = false,
    isMobile = false,
    allSlots,
    onSwapWith,
    onSwitchTo,
    onResetAll,
    onCloseAll,
  }: UnifiedTerminalHeaderProps) {
    const { enabledTools } = useAgentTools()
    const isAgentMode = slot.type === 'project' && slot.activeMode !== 'shell'
    const shouldShowClean = showCleanButton && isAgentMode

    return (
      <div
        className={clsx(
          'flex-shrink-0 flex items-center gap-1',
          isMobile ? 'h-9 px-1.5' : 'h-8 px-2',
        )}
        style={{
          backgroundColor: isActive
            ? 'var(--term-bg-elevated)'
            : 'var(--term-bg-surface)',
          borderBottom: '1px solid var(--term-border)',
        }}
      >
        {/* Mode toggle (shell <-> claude) - only for project slots */}
        {slot.type === 'project' && onModeSwitch && (
          <ModeToggle
            value={slot.activeMode}
            onChange={onModeSwitch}
            disabled={isModeSwitching}
            isLoading={isModeSwitching}
            isMobile={isMobile}
            agentTools={enabledTools}
          />
        )}

        {/* Terminal name/switcher */}
        <HeaderNameDisplay
          slot={slot}
          isActive={isActive}
          isMobile={isMobile}
          allSlots={allSlots}
          onSwapWith={onSwapWith}
          onSwitchTo={onSwitchTo}
          onSwitch={onSwitch}
        />

        {/* Add terminal button */}
        {onOpenModal && (
          <AddTerminalButton
            onOpenModal={onOpenModal}
            canAddPane={canAddPane}
            isMobile={isMobile}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          {shouldShowClean && onClean && (
            <HeaderIconButton
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={onClean}
              tooltip="Clean prompt"
              isMobile={isMobile}
            />
          )}

          {onVoice && (
            <HeaderIconButton
              icon={<Mic className="w-3.5 h-3.5" />}
              onClick={onVoice}
              tooltip="Voice input"
              isMobile={isMobile}
            />
          )}

          {onUpload && (
            <HeaderIconButton
              icon={<Paperclip className="w-3.5 h-3.5" />}
              onClick={onUpload}
              tooltip="Upload file"
              isMobile={isMobile}
            />
          )}

          {onSettings && (
            <HeaderIconButton
              icon={<Settings className="w-3.5 h-3.5" />}
              onClick={onSettings}
              tooltip="Settings"
              isMobile={isMobile}
            />
          )}

          {onReset && (
            <HeaderIconButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onReset}
              tooltip="Reset terminal"
              isMobile={isMobile}
            />
          )}

          {onClose && (
            <HeaderIconButton
              icon={<X className="w-3.5 h-3.5" />}
              onClick={onClose}
              tooltip="Close terminal"
              variant="danger"
              isMobile={isMobile}
            />
          )}

          {(onResetAll || onCloseAll) && (
            <PaneOverflowMenu
              onResetAll={onResetAll}
              onCloseAll={onCloseAll}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    )
  },
)
