import { z } from "zod";
import { ErrorHandler } from "./error.handler";
import type { ErrorResponse } from "../types/response.types";

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: ErrorResponse };

export class Validator {
  static validate<T>(
    schema: z.ZodType<T>,
    data: unknown
  ): ValidationSuccess<T> | ValidationFailure {
    const result = schema.safeParse(data);

    if (!result.success) {
      return {
        success: false,
        error: ErrorHandler.handle(result.error),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  }

  static buildSchema(
    fields: { name: string; type: string; isRequired: boolean }[]
  ): z.ZodType {
    const shape: Record<string, z.ZodType> = {};

    for (const field of fields) {
      let fieldSchema: z.ZodType = Validator.mapTypeToZod(field.type);

      if (!field.isRequired) {
        fieldSchema = fieldSchema.optional();
      }

      shape[field.name] = fieldSchema;
    }

    return z.object(shape);
  }

  private static mapTypeToZod(type: string): z.ZodType {
    switch (type.toLowerCase()) {
      case "string":
      case "text":
      case "varchar":
        return z.string();
      case "int":
      case "integer":
      case "number":
      case "float":
      case "decimal":
        return z.number();
      case "boolean":
      case "bool":
        return z.boolean();
      case "date":
      case "datetime":
        return z.coerce.date();
      case "json":
        return z.record(z.string(), z.unknown());
      default:
        return z.unknown();
    }
  }
}
