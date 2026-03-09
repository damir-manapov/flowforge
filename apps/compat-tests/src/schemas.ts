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

export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  success: z.literal(false),
  message: z.string(),
  stack: z.unknown().optional(),
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

// ── Variables ────────────────────────────────────────────────────────

export const VariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  type: z.string(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const VariableListSchema = z.array(VariableSchema)

// ── API Keys ─────────────────────────────────────────────────────────

export const ApiKeySchema = z.object({
  id: z.string(),
  keyName: z.string(),
  apiKey: z.string(),
  apiSecret: z.string(),
  updatedDate: z.string(),
  permissions: z.array(z.string()),
  chatFlows: z.array(z.unknown()),
  workspaceId: z.string().optional(),
})

export const ApiKeyListSchema = z.array(ApiKeySchema)

// ── Tools ────────────────────────────────────────────────────────────

export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  iconSrc: z.string().nullable(),
  schema: z.string().nullable(),
  func: z.string().nullable(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const ToolListSchema = z.array(ToolSchema)

// ── Assistants ───────────────────────────────────────────────────────

export const AssistantSchema = z.object({
  id: z.string(),
  details: z.string(),
  credential: z.string(),
  iconSrc: z.string().nullable(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const AssistantListSchema = z.array(AssistantSchema)

// ── Document Store ───────────────────────────────────────────────────

/** Shape returned by POST /document-store/store (raw strings for loaders/whereUsed). */
export const DocumentStoreCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  loaders: z.string(),
  whereUsed: z.string(),
  status: z.string(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

/** Shape returned by GET /document-store/store (parsed arrays + totals). */
export const DocumentStoreListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  loaders: z.array(z.unknown()),
  whereUsed: z.array(z.unknown()),
  status: z.string(),
  totalChars: z.number(),
  totalChunks: z.number(),
  createdDate: z.string(),
  updatedDate: z.string(),
})

export const DocumentStoreListSchema = z.array(DocumentStoreListItemSchema)

/** Shape returned by GET /document-store/store/:id. */
export const DocumentStoreDetailSchema = DocumentStoreListItemSchema

/** Shape returned by DELETE /document-store/store/:id. */
export const DocumentStoreDeleteResultSchema = z.object({
  deleted: z.number(),
})

// ── Marketplace Templates ────────────────────────────────────────────

export const MarketplaceTemplateSchema = z
  .object({
    id: z.string(),
    templateName: z.string(),
    flowData: z.string().optional(),
    badge: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    framework: z.array(z.string()).optional(),
    usecases: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  })
  .passthrough()

export const MarketplaceTemplateListSchema = z.array(MarketplaceTemplateSchema)
