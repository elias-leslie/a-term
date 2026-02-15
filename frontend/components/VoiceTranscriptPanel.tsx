'use client'

import { clsx } from 'clsx'
import { Keyboard, Mic, MicOff, Send, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  TranscriptionError,
  TranscriptionStatus,
} from '@agent-hub/passport-client'
import styles from './VoiceTranscriptPanel.module.css'

interface VoiceTranscriptPanelProps {
  transcript: string
  interimTranscript: string
  status: TranscriptionStatus
  error: TranscriptionError
  onSend: (text: string) => void
  onInsert: (text: string) => void
  onCancel: () => void
  onToggleListening: () => void
  onReset: () => void
  isMobile?: boolean
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access denied. Check browser permissions.',
  'no-speech': 'No speech detected. Tap mic to try again.',
  'network': 'Network error. Speech recognition requires internet.',
  'whisper-unavailable': 'Voice server unavailable. Try a different browser.',
  'not-supported': 'Speech recognition not supported in this browser.',
  'aborted': 'Speech recognition was aborted.',
}

const SHORT_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Mic access denied',
  'no-speech': 'No speech detected',
  'network': 'Network error',
  'whisper-unavailable': 'Voice unavailable',
  'not-supported': 'Not supported',
  'aborted': 'Aborted',
}

export function VoiceTranscriptPanel({
  transcript,
  interimTranscript,
  status,
  error,
  onSend,
  onInsert,
  onCancel,
  onToggleListening,
  onReset,
  isMobile,
}: VoiceTranscriptPanelProps) {
  const [editedText, setEditedText] = useState(transcript)
  const [visible, setVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Animate in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Sync transcript updates into edited text
  useEffect(() => {
    setEditedText(transcript)
  }, [transcript])

  // Auto-focus textarea (desktop only)
  useEffect(() => {
    if (visible && !isMobile) {
      textareaRef.current?.focus()
    }
  }, [visible, isMobile])

  const handleSend = useCallback(() => {
    const text = editedText.trim()
    if (text) onSend(text)
  }, [editedText, onSend])

  const handleInsert = useCallback(() => {
    const text = editedText.trim()
    if (text) onInsert(text)
  }, [editedText, onInsert])

  const handleClose = useCallback(() => {
    if (isMobile) {
      onCancel()
      return
    }
    setVisible(false)
    setTimeout(onCancel, 300)
  }, [onCancel, isMobile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    },
    [handleSend, handleClose],
  )

  const isListening = status === 'listening'
  const isProcessing = status === 'processing'
  const hasText = editedText.trim().length > 0 || interimTranscript.length > 0

  // Mobile: inline layout replacing the keyboard slot
  if (isMobile) {
    const displayText = interimTranscript
      ? `${editedText}${editedText ? ' ' : ''}${interimTranscript}`
      : editedText

    // Mic button behavior:
    // - Has text (listening or not) → send
    // - Listening + no text → stop listening
    // - Idle + no text → start listening
    const handleMicTap = () => {
      if (status === 'error') onReset()
      if (hasText) {
        handleSend()
        return
      }
      onToggleListening()
    }

    // Determine mic button appearance
    const showSendIcon = hasText
    const showPulse = isListening && !hasText

    const statusMessage =
      status === 'error' && error
        ? SHORT_ERROR_MESSAGES[error] ?? 'Error'
        : isListening
          ? 'Listening...'
          : isProcessing
            ? 'Processing...'
            : 'Tap to speak'

    return (
      <div
        style={{
          background: 'var(--term-bg-surface)',
          borderTop: '1px solid var(--term-border)',
        }}
      >
        {/* Transcript bubble — only when there's text */}
        {displayText.trim() && (
          <div
            style={{
              maxHeight: 128,
              overflowY: 'auto',
              padding: '8px 12px',
              margin: '8px 12px 0',
              borderRadius: 8,
              background: 'var(--term-bg-elevated)',
              border: '1px solid var(--term-border-active)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--term-text-primary)',
            }}
          >
            {editedText}
            {interimTranscript && (
              <span style={{ color: 'var(--term-accent)', opacity: 0.7 }}>
                {editedText ? ' ' : ''}
                {interimTranscript}
              </span>
            )}
          </div>
        )}

        {/* Status line */}
        <div
          style={{
            textAlign: 'center',
            padding: '6px 0 2px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color:
              status === 'error'
                ? 'var(--term-error)'
                : isListening
                  ? 'var(--term-accent)'
                  : 'var(--term-text-muted)',
          }}
        >
          {statusMessage}
        </div>

        {/* Action row: [X] [MIC] [keyboard] */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: '6px 16px 12px',
          }}
        >
          {/* Cancel button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cancel voice input"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--term-border-active)',
              color: 'var(--term-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Main mic / send button — 64x64 */}
          <button
            type="button"
            className={clsx(showPulse && styles.mobileMicPulse)}
            onClick={handleMicTap}
            disabled={isProcessing}
            aria-label={
              showSendIcon
                ? 'Send transcript'
                : isListening
                  ? 'Stop listening'
                  : 'Start listening'
            }
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              border: `2px solid ${
                showPulse
                  ? 'var(--term-error)'
                  : 'var(--term-accent)'
              }`,
              background: showPulse
                ? 'rgba(248, 81, 73, 0.15)'
                : showSendIcon
                  ? 'rgba(0, 255, 159, 0.15)'
                  : 'rgba(0, 255, 159, 0.08)',
              color: showPulse
                ? 'var(--term-error)'
                : 'var(--term-accent)',
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            {showSendIcon ? (
              <Send className="w-6 h-6" />
            ) : isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          {/* Keyboard button — dismiss voice, return to keyboard */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Return to keyboard"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--term-border-active)',
              color: 'var(--term-text-muted)',
              cursor: 'pointer',
            }}
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // Desktop: existing bottom-sheet overlay
  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(styles.backdrop, visible && styles.backdropVisible)}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={clsx(styles.panel, visible && styles.panelVisible)}>
        <div className={styles.glowTop} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {isListening && <div className={styles.pulsingDot} />}
            <span className={styles.headerTitle}>VOICE_INPUT</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea */}
        <div className={styles.textareaWrapper}>
          <textarea
            ref={textareaRef}
            className={styles.editTextarea}
            value={
              interimTranscript
                ? `${editedText}${editedText ? ' ' : ''}${interimTranscript}`
                : editedText
            }
            onChange={(e) => setEditedText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening... speak now'
                : 'Tap the mic to start dictating'
            }
            readOnly={isListening || isProcessing}
            aria-label="Voice transcript"
          />
        </div>

        {/* Status bar */}
        <div className={styles.statusBar}>
          <span
            className={clsx(
              styles.statusText,
              isListening && styles.statusListening,
              isProcessing && styles.statusProcessing,
              status === 'error' && styles.statusError,
            )}
          >
            {status === 'error' && error
              ? ERROR_MESSAGES[error] ?? 'Unknown error'
              : isListening
                ? 'Listening...'
                : isProcessing
                  ? 'Processing...'
                  : 'Ready'}
          </span>
          <span className={styles.charCount}>
            {editedText.length} chars
          </span>
        </div>

        {/* Action bar */}
        <div className={styles.actionBar}>
          <button
            type="button"
            className={clsx(styles.actionBtn, styles.actionBtnSecondary)}
            onClick={handleClose}
            aria-label="Cancel voice input"
          >
            CANCEL
          </button>

          <button
            type="button"
            className={clsx(
              styles.micBtn,
              isListening && styles.micBtnActive,
            )}
            onClick={() => {
              if (status === 'error') onReset()
              onToggleListening()
            }}
            title={isListening ? 'Stop listening' : 'Start listening'}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <div className={styles.sendGroup}>
            <button
              type="button"
              className={clsx(styles.actionBtn, styles.actionBtnPrimary)}
              onClick={handleSend}
              disabled={!hasText || isProcessing}
              aria-label="Send transcript"
            >
              <Send className="w-3.5 h-3.5" />
              SEND
            </button>
            <button
              type="button"
              className={styles.insertLink}
              onClick={handleInsert}
              disabled={!hasText || isProcessing}
              aria-label="Insert transcript without enter"
            >
              insert without enter
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
