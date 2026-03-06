import { describe, expect, it } from 'vitest'
import { sanitizeFilename } from '../src/services/attachmentService.js'

describe('attachmentService', () => {
  describe('sanitizeFilename', () => {
    it('returns basename from path', () => {
      expect(sanitizeFilename('/etc/passwd')).toBe('passwd')
      expect(sanitizeFilename('/some/dir/file.txt')).toBe('file.txt')
    })

    it('replaces unsafe characters with underscore', () => {
      expect(sanitizeFilename('file:name?.txt')).toBe('file_name_.txt')
      expect(sanitizeFilename('a*b|c"d')).toBe('a_b_c_d')
    })

    it('truncates to 255 characters', () => {
      const long = `${'a'.repeat(300)}.txt`
      expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255)
    })

    it('returns "unnamed" for empty input', () => {
      expect(sanitizeFilename('')).toBe('unnamed')
    })

    it('returns "unnamed" when all characters are unsafe', () => {
      // basename of '///' is empty on posix
      expect(sanitizeFilename('///')).toBe('unnamed')
    })

    it('preserves normal filenames', () => {
      expect(sanitizeFilename('photo.jpg')).toBe('photo.jpg')
      expect(sanitizeFilename('my-doc_v2.pdf')).toBe('my-doc_v2.pdf')
    })

    it('handles path traversal attempts', () => {
      const result = sanitizeFilename('../../etc/shadow')
      expect(result).toBe('shadow')
    })
  })
})
