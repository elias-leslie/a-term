'use client'

import { clsx } from 'clsx'
import { Mic, MicOff, Send, X } from 'lucide-react'
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
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access denied. Check browser permissions.',
  'no-speech': 'No speech detected. Tap mic to try again.',
  'network': 'Network error. Speech recognition requires internet.',
  'whisper-unavailable': 'Voice server unavailable. Try a different browser.',
  'not-supported': 'Speech recognition not supported in this browser.',
  'aborted': 'Speech recognition was aborted.',
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

  // Auto-focus textarea
  useEffect(() => {
    if (visible) {
      textareaRef.current?.focus()
    }
  }, [visible])

  const handleSend = useCallback(() => {
    const text = editedText.trim()
    if (text) onSend(text)
  }, [editedText, onSend])

  const handleInsert = useCallback(() => {
    const text = editedText.trim()
    if (text) onInsert(text)
  }, [editedText, onInsert])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onCancel, 300)
  }, [onCancel])

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
