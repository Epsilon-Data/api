export type TokenHandlerException = Error & {
  readonly statusCode: number;
  readonly code: string;
  readonly logInfo?: string;
  readonly handled?: boolean;
  readonly cause?: Error;
};

export enum Grant {
  AuthorizationCode,
  UserInfo,
  RefreshToken,
}

export const UnhandledException = (
  message?: string,
  cause?: Error,
  logInfo?: string,
  handled = true,
): TokenHandlerException => ({
  message: message || 'A technical problem occurred in the Token Handler',
  statusCode: 500,
  code: 'server_error',
  name: 'server_error',
  cause,
  logInfo,
  handled,
});

export const AuthorizationClientException = (
  grant: Grant,
  status: number,
  responseText: string,
  message?: string,
  handled = true,
): TokenHandlerException => {
  if (grant === Grant.UserInfo && status === 401) {
    return {
      message:
        message || 'A request sent to the Authorization Server was rejected',
      code: 'token_expired',
      name: 'token_expired',
      statusCode: 401,
      logInfo: `${Grant[grant]} request failed with status: ${status} and response: ${responseText}`,
      handled,
    };
  }
  if (
    grant === Grant.RefreshToken &&
    responseText.indexOf('invalid_grant') !== -1
  ) {
    return {
      message:
        message || 'A request sent to the Authorization Server was rejected',
      code: 'session_expired',
      name: 'session_expired',
      statusCode: 401,
      logInfo: `${Grant[grant]} request failed with status: ${status} and response: ${responseText}`,
      handled,
    };
  }
  return {
    message:
      message || 'A request sent to the Authorization Server was rejected',
    code: 'authorization_error',
    name: 'authorization_error',
    statusCode: 400,
    logInfo: `${Grant[grant]} request failed with status: ${status} and response: ${responseText}`,
    handled,
  };
};

export const AuthorizationResponseException = (
  message: string,
  error: string,
  handled = true,
): TokenHandlerException => {
  if (error === 'login_required') {
    return {
      message: message,
      code: error,
      name: error,
      statusCode: 401,
      handled,
    };
  }
  return {
    message: message,
    code: error,
    name: error,
    statusCode: 400,
    handled,
  };
};

export const AuthorizationServerException = (
  message?: string,
  cause?: Error,
  logInfo?: string,
  handled = true,
): TokenHandlerException => ({
  message:
    message || 'A problem occurred with a request to the Authorization Server',
  statusCode: 502,
  code: 'authorization_server_error',
  name: 'authorization_server_error',
  cause,
  logInfo,
  handled,
});

export const CookieDecryptionException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'Access denied due to invalid request details',
  statusCode: 401,
  code: 'unauthorized_request',
  name: 'unauthorized_request',
  cause,
  handled,
});

export const InvalidCookieException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'Access denied due to invalid request details',
  statusCode: 401,
  code: 'unauthorized_request',
  name: 'unauthorized_request',
  cause,
  handled,
});

export const InvalidIDTokenException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'ID Token missing or invalid',
  statusCode: 400,
  code: 'invalid_request',
  name: 'invalid_request',
  cause,
  handled,
});

export const UnauthorizedException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'Access denied due to invalid request details',
  statusCode: 401,
  code: 'unauthorized_request',
  name: 'unauthorized_request',
  cause,
  handled,
});

export const InvalidRequestException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'Invalid request',
  statusCode: 400,
  code: 'invalid_request',
  name: 'invalid_request',
  cause,
  handled,
});

export const MissingCodeVerifierException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'Missing code verifier when completing a login',
  statusCode: 400,
  code: 'invalid_request',
  name: 'invalid_request',
  cause,
  handled,
});

export const InvalidStateException = (
  message?: string,
  cause?: Error,
  handled = true,
): TokenHandlerException => ({
  message: message || 'State parameter mismatch when completing a login',
  statusCode: 400,
  code: 'invalid_request',
  name: 'invalid_request',
  cause,
  handled,
});
