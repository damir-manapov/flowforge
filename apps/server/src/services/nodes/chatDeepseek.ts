/**
 * ChatDeepseek node — wraps ChatOpenAI with Deepseek API base URL.
 *
 * Matches the original Flowise ChatDeepseek node behaviour:
 * uses @langchain/openai ChatOpenAI with baseURL 'https://api.deepseek.com'.
 */

import { ChatOpenAI } from '@langchain/openai'
import type { NodeData } from '../nodeRegistry.js'

export async function initChatDeepseek(
  nodeData: NodeData,
  credentialData?: Record<string, unknown>,
): Promise<ChatOpenAI> {
  const inputs = nodeData.inputs

  const apiKey = credentialData?.deepseekApiKey as string | undefined
  if (!apiKey) {
    throw new Error('ChatDeepseek: missing deepseekApiKey in credential data')
  }

  const baseURL = (nodeData.baseURL as string) || 'https://api.deepseek.com'
  const modelName = (inputs.modelName as string) || 'deepseek-chat'
  const temperature = inputs.temperature != null ? Number(inputs.temperature) : 0.7
  const streaming = inputs.streaming != null ? Boolean(inputs.streaming) : true

  const config: ConstructorParameters<typeof ChatOpenAI>[0] = {
    modelName,
    temperature,
    streaming,
    openAIApiKey: apiKey,
    apiKey,
    configuration: {
      baseURL,
    },
  }

  if (inputs.maxTokens) config.maxTokens = Number(inputs.maxTokens)
  if (inputs.topP) config.topP = Number(inputs.topP)
  if (inputs.frequencyPenalty) config.frequencyPenalty = Number(inputs.frequencyPenalty)
  if (inputs.presencePenalty) config.presencePenalty = Number(inputs.presencePenalty)
  if (inputs.timeout) config.timeout = Number(inputs.timeout)

  if (inputs.stopSequence) {
    const stops = (inputs.stopSequence as string).split(',').map((s) => s.trim())
    config.stop = stops
  }

  return new ChatOpenAI(config)
}
