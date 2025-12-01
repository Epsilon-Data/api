export class KeycloakAdminError extends Error {
  constructor(
    message: string,
    public readonly original?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class KeycloakBadRequestError extends KeycloakAdminError {}
export class KeycloakUnauthorizedError extends KeycloakAdminError {}
export class KeycloakForbiddenError extends KeycloakAdminError {}
export class KeycloakNotFoundError extends KeycloakAdminError {}
export class KeycloakConflictError extends KeycloakAdminError {}
export class KeycloakUnavailableError extends KeycloakAdminError {}
