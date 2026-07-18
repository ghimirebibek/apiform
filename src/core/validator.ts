import { z } from "zod";
import { ErrorHandler } from "./error.handler";
import type { ErrorResponse } from "../types/response.types";
import type { EnumDefinition } from "../types/adapter.types";

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: ErrorResponse };
type EnumLookup = (name: string) => EnumDefinition | undefined;

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
    fields: { name: string; type: string; isRequired: boolean }[],
    getEnum?: EnumLookup
  ): z.ZodType {
    const shape: Record<string, z.ZodType> = {};

    for (const field of fields) {
      let fieldSchema: z.ZodType = Validator.mapTypeToZod(field.type, getEnum);

      if (!field.isRequired) {
        fieldSchema = fieldSchema.optional();
      }

      shape[field.name] = fieldSchema;
    }

    return z.object(shape);
  }

  private static mapTypeToZod(type: string, getEnum?: EnumLookup): z.ZodType {
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
    }

    const enumDef = getEnum?.(type);
    if (enumDef && enumDef.values.length > 0) {
      return z.enum(enumDef.values as [string, ...string[]]);
    }

    return z.unknown();
  }
}
