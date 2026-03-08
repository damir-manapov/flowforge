import { describe, expect, it } from 'vitest'
import { buildUploadedFile } from '../src/services/attachmentService.js'
import { UUID_RE } from './_helpers/fixtures.js'

describe('buildUploadedFile', () => {
  it('returns an UploadedFile with sanitized name', () => {
    const file = buildUploadedFile('/etc/passwd', 1024, 'text/plain')
    expect(file.name).toBe('passwd')
    expect(file.size).toBe(1024)
    expect(file.type).toBe('text/plain')
    expect(file.id).toMatch(UUID_RE)
  })

  it('generates unique ids per call', () => {
    const a = buildUploadedFile('a.txt', 10, 'text/plain')
    const b = buildUploadedFile('b.txt', 20, 'text/plain')
    expect(a.id).not.toBe(b.id)
  })

  it('preserves mimetype as-is', () => {
    const file = buildUploadedFile('photo.png', 5000, 'image/png')
    expect(file.type).toBe('image/png')
  })

  it('handles unsafe filenames', () => {
    const file = buildUploadedFile('file:name?.txt', 100, 'text/plain')
    expect(file.name).toBe('file_name_.txt')
  })
})
