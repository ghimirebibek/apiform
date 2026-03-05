import type { ModelDefinition } from "../types/adapter.types";

export class SoftDeleteManager {
  // Check if a model has soft delete enabled and return the field name
  static getDeletedAtField(
    model: ModelDefinition,
    softDeleteConfig?: boolean | string
  ): string | null {
    if (softDeleteConfig === false) {
      return null;
    }

    if (softDeleteConfig === true) {
      return "deletedAt";
    }

    if (typeof softDeleteConfig === "string") {
      return softDeleteConfig;
    }

    const hasDeletedAt = model.fields.some((f) => f.name === "deletedAt");
    return hasDeletedAt ? "deletedAt" : null;
  }

  static excludeDeleted(
    where: Record<string, unknown>,
    deletedAtField: string
  ): Record<string, unknown> {
    return {
      ...where,
      [deletedAtField]: null,
    };
  }

  static onlyDeleted(
    where: Record<string, unknown>,
    deletedAtField: string
  ): Record<string, unknown> {
    return {
      ...where,
      [deletedAtField]: { not: null },
    };
  }

  static softDeleteData(deletedAtField: string): Record<string, unknown> {
    return {
      [deletedAtField]: new Date(),
    };
  }

  static restoreData(deletedAtField: string): Record<string, unknown> {
    return {
      [deletedAtField]: null,
    };
  }
}
