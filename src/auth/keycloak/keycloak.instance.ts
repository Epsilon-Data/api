export type KeycloakConnectConfig = {
  /**
   * Realm ID.
   */
  realm: string;

  /**
   * Client/Application ID.
   */
  resource?: string;

  /**
   * Client/Application ID.
   * @see {KeycloakConnectOptions#resource}
   */
  'client-id'?: string;
  /**
   * Client/Application ID.
   * @see {KeycloakConnectOptions#resource}
   */
  clientId?: string;

  /**
   * Client/Application secret.
   */
  credentials?: KeycloakCredentials;
  /**
   * Client/Application secret.
   * @see {KeycloakCredentials#secret}
   */
  secret?: string;

  /**
   * Authentication server URL.
   * @see {KeycloakConnectOptions#authServerUrl}
   */
  'auth-server-url'?: string;
  /**
   * Authentication server URL.
   * @see {KeycloakConnectOptions#authServerUrl}
   */
  'server-url'?: string;
  /**
   * Authentication server URL.
   * @see {KeycloakConnectOptions#authServerUrl}
   */
  serverUrl?: string;
  /**
   * Authentication server URL.
   */
  authServerUrl?: string;

  /**
   *  Response mode of permissions
   */
  responseMode?: string;
  response_mode?: string;
};

/**
 * Represents Keycloak credentials.
 */
export type KeycloakCredentials = {
  /**
   * Client/Application secret.
   */
  secret: string;
};
