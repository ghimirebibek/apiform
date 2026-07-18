import type { ModelDefinition, ModelField } from "../types/adapter.types";

// Fields a client may set on create/update: excludes the PK, any
// @updatedAt field, any field auto-defaulted via @default(now()) (e.g.
// createdAt — regardless of what it's actually named), and the model's
// resolved soft-delete field (which itself may be renamed via config).
// Shared by CrudEngine (runtime validation) and OpenApiBuilder (docs), so
// the two can never drift on what's actually writable.
export function getWritableFields(
  modelDef: ModelDefinition,
  softDeleteField: string | null
): ModelField[] {
  return modelDef.fields.filter((f) => {
    if (f.isId) return false;
    if (f.isUpdatedAt) return false;
    if (f.default === "now()") return false;
    if (softDeleteField && f.name === softDeleteField) return false;
    return true;
  });
}
