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

// ── Credentials ──────────────────────────────────────────────────────

/** Credential as returned by POST (create) and PUT (update) — includes encryptedData. */
export const CredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  credentialName: z.string(),
  encryptedData: z.string(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

/** Credential as returned by GET /credentials (list) — no encryptedData. */
export const CredentialListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  credentialName: z.string(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const CredentialListSchema = z.array(CredentialListItemSchema)

/** Credential as returned by GET /credentials/:id — decrypted+redacted. */
export const CredentialWithPlainDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  credentialName: z.string(),
  createdDate: z.string(),
  updatedDate: z.string(),
  plainDataObj: z.record(z.string(), z.unknown()),
})

/** Flowise DeleteResult shape. */
export const DeleteResultSchema = z.object({
  raw: z.array(z.unknown()),
  affected: z.number(),
})

// ── Components-credentials catalog ───────────────────────────────────

export const CredentialTypeSchema = z.object({
  label: z.string(),
  name: z.string(),
  version: z.number(),
  description: z.string().optional(),
  optional: z.boolean().optional(),
  inputs: z
    .array(
      z
        .object({
          label: z.string(),
          name: z.string(),
          type: z.string(),
        })
        .passthrough(),
    )
    .optional(),
  icon: z.string().optional(),
})

export const CredentialTypeListSchema = z.array(CredentialTypeSchema)
