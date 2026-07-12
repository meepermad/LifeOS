export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super("AUTHENTICATION_ERROR", message, 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super("AUTHORIZATION_ERROR", message, 403);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

export class ConfigurationError extends AppError {
  constructor(message = "Configuration error") {
    super("CONFIGURATION_ERROR", message, 500);
    this.name = "ConfigurationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Operation not allowed") {
    super("CONFLICT_ERROR", message, 409);
    this.name = "ConflictError";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database operation failed") {
    super("DATABASE_ERROR", message, 500);
    this.name = "DatabaseError";
  }
}
