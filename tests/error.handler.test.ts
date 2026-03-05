import { describe, it, expect } from "bun:test";
import { ErrorHandler } from "../src/core/error.handler";
import { ErrorCode } from "../src/types/response.types";

describe("ErrorHandler", () => {
  it("should handle a generic Error", () => {
    const error = new Error("Something went wrong");
    const response = ErrorHandler.handle(error);

    expect(response.success).toBe(false);
    expect(response.message).toBe("Something went wrong");
    expect(response.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should handle an unknown error", () => {
    const response = ErrorHandler.handle("unknown error");

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should handle Prisma P2002 unique constraint error", () => {
    const prismaError = { code: "P2002", meta: { target: ["email"] } };
    const response = ErrorHandler.handle(prismaError);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.CONFLICT);
    expect(response.error?.details).toEqual({ fields: ["email"] });
  });

  it("should handle Prisma P2025 not found error", () => {
    const prismaError = { code: "P2025" };
    const response = ErrorHandler.handle(prismaError);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("should handle Prisma P2003 foreign key error", () => {
    const prismaError = { code: "P2003", meta: { field_name: "userId" } };
    const response = ErrorHandler.handle(prismaError);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it("should handle unknown Prisma errors", () => {
    const prismaError = { code: "P9999" };
    const response = ErrorHandler.handle(prismaError);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should handle Zod validation errors", () => {
    const zodError = {
      errors: [{ message: "Invalid email", path: ["email"] }],
    };
    const response = ErrorHandler.handle(zodError);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
