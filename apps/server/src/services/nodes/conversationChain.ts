/**
 * ConversationChain node — chains a chat model with memory for conversation.
 *
 * Matches the original Flowise ConversationChain node semantics.
 * LangChain v1.x removed the legacy ConversationChain class.
 * We implement the same behaviour using ChatModel + prompt + memory directly.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { type BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { IterableReadableStream } from '@langchain/core/utils/stream'
import type { NodeData } from '../nodeRegistry.js'
import type { FlowMemory } from './bufferMemory.js'

const DEFAULT_SYSTEM_MESSAGE =
  'The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.'

export interface FlowChain {
  /** Invoke the chain with streaming. Returns an async iterable of string chunks. */
  stream(input: string): Promise<IterableReadableStream<string>>
  /** Invoke the chain without streaming. Returns the full response text. */
  invoke(input: string): Promise<string>
}

export async function initConversationChain(nodeData: NodeData): Promise<FlowChain> {
  const inputs = nodeData.inputs

  const model = inputs.model as BaseChatModel | undefined
  if (!model) {
    throw new Error('ConversationChain: missing model input')
  }

  const memory = inputs.memory as FlowMemory | undefined
  const systemMessage = (inputs.systemMessagePrompt as string) || DEFAULT_SYSTEM_MESSAGE

  function buildMessages(input: string): BaseMessage[] {
    const messages: BaseMessage[] = [new SystemMessage(systemMessage)]
    if (memory) {
      messages.push(...memory.getMessages())
    }
    messages.push(new HumanMessage(input))
    return messages
  }

  return {
    async stream(input: string) {
      const messages = buildMessages(input)
      const stream = await model.stream(messages)

      // Wrap to also save to memory after streaming completes
      const chunks: string[] = []
      const originalStream = stream

      // Create a transformed stream that collects chunks for memory
      async function* transformedStream() {
        for await (const chunk of originalStream) {
          const text = typeof chunk.content === 'string' ? chunk.content : ''
          chunks.push(text)
          yield text
        }
        // After stream completes, save to memory
        if (memory) {
          memory.addMessage(new HumanMessage(input))
          const { AIMessage } = await import('@langchain/core/messages')
          memory.addMessage(new AIMessage(chunks.join('')))
        }
      }

      // Return as IterableReadableStream by converting the generator
      const { IterableReadableStream: IRS } = await import('@langchain/core/utils/stream')
      return IRS.fromAsyncGenerator(transformedStream())
    },

    async invoke(input: string) {
      const messages = buildMessages(input)
      const result = await model.invoke(messages)
      const text = typeof result.content === 'string' ? result.content : ''

      if (memory) {
        memory.addMessage(new HumanMessage(input))
        const { AIMessage } = await import('@langchain/core/messages')
        memory.addMessage(new AIMessage(text))
      }

      return text
    },
  }
}
