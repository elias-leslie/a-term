'use client'

export interface AgentHubCatalogModel {
  id: string
  name: string
  alias: string
  provider: string
  speed_tier?: string
}

export interface ClaudeModelOption {
  id: string
  label: string
  command: string
}

interface AgentHubModelsResponse {
  models: AgentHubCatalogModel[]
}

const CLAUDE_MODEL_ALIASES = ['opus', 'sonnet', 'haiku'] as const
const CLAUDE_MODEL_PREFERENCE = ['haiku', 'sonnet', 'opus'] as const

let cachedModels: AgentHubCatalogModel[] | null = null
let fetchPromise: Promise<AgentHubCatalogModel[]> | null = null

function getAgentHubUrl(): string | null {
  return process.env.NEXT_PUBLIC_AGENT_HUB_URL || null
}

function formatClaudeLabel(model: AgentHubCatalogModel): string {
  return model.alias.charAt(0).toUpperCase() + model.alias.slice(1)
}

function getFallbackClaudeModelOptions(): ClaudeModelOption[] {
  return CLAUDE_MODEL_ALIASES.map((alias) => ({
    id: alias,
    label: alias.charAt(0).toUpperCase() + alias.slice(1),
    command: `/model ${alias}\r`,
  }))
}

async function fetchModelsFromApi(): Promise<AgentHubCatalogModel[]> {
  const agentHubUrl = getAgentHubUrl()
  if (!agentHubUrl) return []

  try {
    const response = await fetch(`${agentHubUrl}/api/models`)
    if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`)
    const data: AgentHubModelsResponse = await response.json()
    return data.models || []
  } catch {
    return []
  }
}

export async function getAgentHubModels(): Promise<AgentHubCatalogModel[]> {
  if (cachedModels) return cachedModels
  if (!fetchPromise) {
    fetchPromise = fetchModelsFromApi().then((models) => {
      cachedModels = models
      fetchPromise = null
      return models
    })
  }
  return fetchPromise
}

export async function getClaudeModelOptions(): Promise<ClaudeModelOption[]> {
  const models = await getAgentHubModels()
  const options = models
    .filter(
      (model) =>
        model.provider === 'claude' &&
        CLAUDE_MODEL_ALIASES.includes(
          model.alias as (typeof CLAUDE_MODEL_ALIASES)[number],
        ),
    )
    .sort(
      (a, b) =>
        CLAUDE_MODEL_ALIASES.indexOf(
          a.alias as (typeof CLAUDE_MODEL_ALIASES)[number],
        ) -
        CLAUDE_MODEL_ALIASES.indexOf(
          b.alias as (typeof CLAUDE_MODEL_ALIASES)[number],
        ),
    )
    .map((model) => ({
      id: model.id,
      label: formatClaudeLabel(model),
      command: `/model ${model.alias}\r`,
    }))

  return options.length > 0 ? options : getFallbackClaudeModelOptions()
}

export async function getPromptCleanerModel(): Promise<string> {
  const models = await getAgentHubModels()

  for (const alias of CLAUDE_MODEL_PREFERENCE) {
    const model = models.find(
      (entry) => entry.provider === 'claude' && entry.alias === alias,
    )
    if (model) return model.id
  }

  return 'haiku'
}

export function clearAgentHubModelCache(): void {
  cachedModels = null
  fetchPromise = null
}
