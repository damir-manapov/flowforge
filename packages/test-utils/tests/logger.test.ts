import { describe, expect, it, vi } from 'vitest'
import { logger } from '../src/logger.js'

describe('logger', () => {
  it('has debug, info, warn, error methods', () => {
    expect(logger.debug).toBeTypeOf('function')
    expect(logger.info).toBeTypeOf('function')
    expect(logger.warn).toBeTypeOf('function')
    expect(logger.error).toBeTypeOf('function')
  })

  it('info logs to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('test message')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]?.[0]).toContain('test message')
    expect(spy.mock.calls[0]?.[0]).toContain('[INFO]')
    spy.mockRestore()
  })

  it('warn logs to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('warning!')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]?.[0]).toContain('[WARN]')
    spy.mockRestore()
  })

  it('error logs to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('err msg')
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]?.[0]).toContain('[ERROR]')
    spy.mockRestore()
  })

  it('includes context as JSON when provided', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('with ctx', { key: 'value' })
    expect(spy.mock.calls[0]?.[0]).toContain('"key":"value"')
    spy.mockRestore()
  })

  it('includes ISO timestamp', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('timestamp check')
    // ISO timestamp pattern
    expect(spy.mock.calls[0]?.[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
    spy.mockRestore()
  })
})
