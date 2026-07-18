import type { ModelDefinition } from "../types/adapter.types";

const MAX_MASK_DEPTH = 8;

export class FieldMasker {
  // Strip a model's configured `omit` fields from response data, recursing
  // into included relations using each related model's own omit config.
  // Depth is capped (rather than guarded by "model already seen") so that
  // self-relations (e.g. User.manager -> User) still get masked instead of
  // silently passing sensitive fields through on the first recursion.
  static mask(
    data: unknown,
    modelName: string,
    getModel: (name: string) => ModelDefinition | undefined,
    getOmitFields: (name: string) => string[],
    depth = 0
  ): unknown {
    if (data === null || data === undefined || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) =>
        FieldMasker.mask(item, modelName, getModel, getOmitFields, depth)
      );
    }

    const modelDef = getModel(modelName);
    if (!modelDef) return data;

    const omit = new Set(getOmitFields(modelName).map((f) => f.toLowerCase()));
    const record = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (omit.has(key.toLowerCase())) continue;

      const field = modelDef.fields.find((f) => f.name === key);
      const relatedModelName = field?.type.replace("[]", "");
      const isRelation = relatedModelName
        ? getModel(relatedModelName) !== undefined
        : false;

      result[key] =
        isRelation && depth < MAX_MASK_DEPTH
          ? FieldMasker.mask(
              value,
              relatedModelName as string,
              getModel,
              getOmitFields,
              depth + 1
            )
          : value;
    }

    return result;
  }

  // Top-level projection for ?fields=. Runs after mask(), so an omitted
  // field can never be re-selected — it's simply absent from `data`.
  static select(data: unknown, fields?: string[]): unknown {
    if (!fields || fields.length === 0) return data;

    const keep = new Set(fields);
    const pick = (item: unknown): unknown => {
      if (item === null || item === undefined || typeof item !== "object") {
        return item;
      }
      const record = item as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(record)) {
        if (keep.has(key)) result[key] = record[key];
      }
      return result;
    };

    return Array.isArray(data) ? data.map(pick) : pick(data);
  }
}
