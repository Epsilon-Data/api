import { NextFunction, Request, Response } from 'express'
import { RequestLogOptions, startRequestLog, writeOutput } from './requestLog'

const loggingMiddleware = (
  request: Readonly<Request>,
  response: Readonly<Response>,
  next: NextFunction,
) => {
  const startOptions: RequestLogOptions = startRequestLog(request)
  response.on('finish', () => {
    // include exception if there is any and log it if needed
    writeOutput(response.statusCode, startOptions, response.locals.log)
  })

  next()
}

export default loggingMiddleware
