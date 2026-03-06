export interface UploadedFile {
  name: string
  size: number
  type: string
  id: string
}

export interface AttachmentResult {
  chatflowId: string
  chatId: string
  files: UploadedFile[]
}
