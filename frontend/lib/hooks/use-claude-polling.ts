/**
 * @deprecated Use use-agent-polling.ts instead.
 * This file re-exports for backward compatibility.
 */
export {
  useAgentPolling as useClaudePolling,
  AGENT_POLL_INTERVAL_MS as CLAUDE_POLL_INTERVAL_MS,
  AGENT_POLL_TIMEOUT_MS as CLAUDE_POLL_TIMEOUT_MS,
} from './use-agent-polling'
