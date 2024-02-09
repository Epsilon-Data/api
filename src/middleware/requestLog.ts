import { Request } from 'express'
import { TokenHandlerException } from './exceptions'

export type RequestLogOptions = {
  readonly time?: string
  readonly method?: string
  readonly path?: string
  readonly status?: number
  readonly error?: TokenHandlerException
}

export const startRequestLog = (
  request: Readonly<Request>,
): RequestLogOptions => {
  return {
    time: new Date().toUTCString(),
    method: request.method,
    path: request.originalUrl,
  }
}

export const writeOutput = (
  status: number,
  start: RequestLogOptions,
  error?: Readonly<TokenHandlerException>,
): void => {
  // Only output log details when there is an error
  if (status && status >= 400) {
    let stack = ''
    let logInfo = ''
    if (error) {
      logInfo = error.logInfo || ''
      if (error.stack) {
        stack = error.stack
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cause = (error as any).cause
      if (cause) {
        if (cause.message) {
          logInfo += `, ${cause.message}`
        }
        if (cause.logInfo) {
          logInfo += `, ${cause.logInfo}`
        }
        if (cause.stack) {
          stack = cause.stack
        }
      }
    }
    // TODO: better logging handling based on status codes
    const logResponse = `${start.time || ''} ${start.method || ''} ${
      start.path || ''
    } ${start.status?.toString() || ''} ${error?.code || ''} ${
      error?.message || ''
    } ${logInfo || ''} ${status && status >= 500 && stack ? stack : ''}`
    // TODO: create separate middleware for logging
    console.log(logResponse)
  }
}
