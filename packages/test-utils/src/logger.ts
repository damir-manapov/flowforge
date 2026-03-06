type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL
  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel as LogLevel
  }
  return 'info'
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getMinLevel()]
}

function formatMessage(level: LogLevel, message: string, context?: Record<string, unknown> | undefined): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  if (context) {
    return `${prefix} ${message} ${JSON.stringify(context)}`
  }
  return `${prefix} ${message}`
}

export const logger = {
  debug(message: string, context?: Record<string, unknown> | undefined): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: Record<string, unknown> | undefined): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, context))
    }
  },

  warn(message: string, context?: Record<string, unknown> | undefined): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context))
    }
  },

  error(message: string, context?: Record<string, unknown> | undefined): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, context))
    }
  },
}
