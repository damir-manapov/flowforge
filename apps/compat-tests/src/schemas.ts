import { z } from 'zod'

export const ChatflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  flowData: z.string(),
  deployed: z.boolean(),
  isPublic: z.boolean(),
  apikeyid: z.string(),
  chatbotConfig: z.string().nullable(),
  apiConfig: z.string().nullable(),
  analytic: z.string().nullable(),
  speechToText: z.string().nullable(),
  category: z.string().nullable(),
  type: z.enum(['CHATFLOW', 'MULTIAGENT']),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const ChatflowListSchema = z.array(ChatflowSchema)

export const PredictionResponseSchema = z.object({
  text: z.string(),
  question: z.string(),
  chatId: z.string(),
  chatMessageId: z.string(),
  sessionId: z.string(),
  sourceDocuments: z.array(z.unknown()).optional(),
  usedTools: z.array(z.unknown()).optional(),
  fileAnnotations: z.array(z.unknown()).optional(),
  agentReasoning: z.array(z.unknown()).optional(),
  memoryType: z.string().nullable().optional(),
})

export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    success: z.literal(false).optional(),
    stack: z.unknown().optional(),
  })
  .refine((v) => v.message !== undefined || v.error !== undefined, {
    message: 'Must have message or error field',
  })

export const AttachmentResponseSchema = z.object({
  chatflowId: z.string(),
  chatId: z.string(),
  files: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      type: z.string(),
      id: z.string(),
    }),
  ),
})
