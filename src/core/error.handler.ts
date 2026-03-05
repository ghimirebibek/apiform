import { ErrorCode } from "../types/response.types";
import type { ErrorResponse } from "../types/response.types";
import { ResponseFormatter } from "./response.formatter";

export class ErrorHandler {
  static handle(error: unknown): ErrorResponse {
    // Prisma known errors
    if (isPrismaError(error)) {
      return ErrorHandler.handlePrismaError(error);
    }

    // Zod validation errors
    if (isZodError(error)) {
      return ResponseFormatter.error(
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.VALIDATION_ERROR,
        error.errors
      );
    }

    // Generic JS errors
    if (error instanceof Error) {
      return ResponseFormatter.error(error.message, ErrorCode.INTERNAL_ERROR);
    }

    // Unknown
    return ResponseFormatter.error(
      "An unexpected error occurred",
      ErrorCode.INTERNAL_ERROR
    );
  }

  private static handlePrismaError(error: PrismaError): ErrorResponse {
    switch (error.code) {
      case "P2002":
        return ResponseFormatter.error(
          "A record with this value already exists",
          ErrorCode.CONFLICT,
          { fields: error.meta?.target }
        );
      case "P2025":
        return ResponseFormatter.error("Record not found", ErrorCode.NOT_FOUND);
      case "P2003":
        return ResponseFormatter.error(
          "Related record not found",
          ErrorCode.BAD_REQUEST,
          { field: error.meta?.field_name }
        );
      case "P2014":
        return ResponseFormatter.error(
          "Invalid relation",
          ErrorCode.BAD_REQUEST
        );
      default:
        return ResponseFormatter.error(
          "Database error occurred",
          ErrorCode.INTERNAL_ERROR,
          { code: error.code }
        );
    }
  }
}

// Type guards
interface PrismaError {
  code: string;
  meta?: Record<string, unknown>;
}

interface ZodError {
  errors: unknown[];
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as PrismaError).code === "string" &&
    (error as PrismaError).code.startsWith("P")
  );
}

function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as ZodError).errors)
  );
}
