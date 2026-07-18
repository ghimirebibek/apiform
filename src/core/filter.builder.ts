import type { ModelDefinition } from "../types/adapter.types";

const ALLOWED_OPERATORS = new Set([
  "equals",
  "not",
  "in",
  "notIn",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "startsWith",
  "endsWith",
]);

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export class FilterBuilder {
  // Sanitizes a client-supplied `filters` object into a safe Prisma where
  // clause: only real scalar fields on the model may be filtered, and only
  // a whitelisted set of operators with primitive values is allowed. Every
  // relation field, unknown key, and unrecognized operator is dropped.
  static build(
    filters: Record<string, unknown>,
    modelDef: ModelDefinition,
    allModelNames: Set<string>
  ): Record<string, unknown> {
    const scalarFieldNames = new Set(
      modelDef.fields
        .filter((f) => FilterBuilder.isFilterableScalar(f, allModelNames))
        .map((f) => f.name)
    );

    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (!scalarFieldNames.has(key)) continue;

      const sanitized = FilterBuilder.sanitizeValue(value);
      if (sanitized !== undefined) safe[key] = sanitized;
    }

    return safe;
  }

  // Used to validate a single field name (e.g. ?searchBy=) against the
  // same scalar-field whitelist used for `filters`.
  static isFilterableField(
    fieldName: string,
    modelDef: ModelDefinition,
    allModelNames: Set<string>
  ): boolean {
    const field = modelDef.fields.find((f) => f.name === fieldName);
    return field ? FilterBuilder.isFilterableScalar(field, allModelNames) : false;
  }

  private static isFilterableScalar(
    field: { name: string; type: string },
    allModelNames: Set<string>
  ): boolean {
    const isList = field.type.endsWith("[]");
    const baseType = field.type.replace("[]", "").toLowerCase();
    const isRelation = allModelNames.has(baseType);
    return !isList && !isRelation;
  }

  private static sanitizeValue(value: unknown): unknown {
    if (isPrimitive(value)) return value;

    if (Array.isArray(value)) return undefined; // bare arrays aren't a valid filter shape

    if (typeof value !== "object" || value === null) return undefined;

    const sanitizedOp: Record<string, unknown> = {};
    for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
      if (!ALLOWED_OPERATORS.has(op)) continue;

      if (op === "in" || op === "notIn") {
        if (Array.isArray(opValue)) {
          sanitizedOp[op] = opValue.filter(isPrimitive);
        }
      } else if (isPrimitive(opValue)) {
        sanitizedOp[op] = opValue;
      }
    }

    return Object.keys(sanitizedOp).length > 0 ? sanitizedOp : undefined;
  }
}
