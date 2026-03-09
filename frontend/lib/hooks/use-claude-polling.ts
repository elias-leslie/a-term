/**
 * @deprecated Use use-agent-polling.ts instead.
 * This file re-exports for backward compatibility.
 */
export {
  AGENT_POLL_INTERVAL_MS as CLAUDE_POLL_INTERVAL_MS,
  AGENT_POLL_TIMEOUT_MS as CLAUDE_POLL_TIMEOUT_MS,
  useAgentPolling as useClaudePolling,
} from './use-agent-polling'
