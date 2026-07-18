import type { BaseAdapter } from "../adapters/base.adapter";
import type { RouteConfig } from "./route.config";
import type { OpenApiConfig } from "../types/config.types";
import { getWritableFields } from "../core/writable-fields";
import type { EnumDefinition, ModelDefinition, ModelField } from "../types/adapter.types";

type JsonSchema = Record<string, unknown>;
type EnumLookup = (name: string) => EnumDefinition | undefined;

function fieldToJsonSchema(field: ModelField, getEnum: EnumLookup): JsonSchema {
  const isArray = field.type.endsWith("[]");
  const baseType = field.type.replace("[]", "");

  let itemSchema: JsonSchema;
  switch (baseType.toLowerCase()) {
    case "string":
    case "text":
    case "varchar":
      itemSchema = { type: "string" };
      break;
    case "int":
    case "integer":
    case "number":
    case "float":
    case "decimal":
    case "bigint":
      itemSchema = { type: "number" };
      break;
    case "boolean":
    case "bool":
      itemSchema = { type: "boolean" };
      break;
    case "date":
    case "datetime":
      itemSchema = { type: "string", format: "date-time" };
      break;
    case "json":
      itemSchema = { type: "object", additionalProperties: true };
      break;
    default: {
      const enumDef = getEnum(baseType);
      itemSchema = enumDef ? { type: "string", enum: enumDef.values } : {};
    }
  }

  return isArray ? { type: "array", items: itemSchema } : itemSchema;
}

// Full output shape for a model (all non-omitted fields). additionalProperties
// stays true — this schema is documentation only (static-mode OpenAPI), never
// attached to a live Fastify route, so it can't cause response fields (like
// ?include=d relations) to be silently stripped by a serializer.
function buildRecordSchema(
  modelDef: ModelDefinition,
  omitFields: string[],
  getEnum: EnumLookup
): JsonSchema {
  const omit = new Set(omitFields.map((f) => f.toLowerCase()));
  const properties: Record<string, JsonSchema> = {};
  for (const field of modelDef.fields) {
    if (omit.has(field.name.toLowerCase())) continue;
    properties[field.name] = fieldToJsonSchema(field, getEnum);
  }
  return { type: "object", properties, additionalProperties: true };
}

// Mirrors the same writable-field set Validator validates against (both
// pull from getWritableFields), using the same field-to-schema mapping as
// the response record schema so request/response docs render consistently.
function buildBodySchema(fields: ModelField[], getEnum: EnumLookup): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.name] = fieldToJsonSchema(field, getEnum);
    if (field.isRequired) required.push(field.name);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function successEnvelope(dataSchema: JsonSchema): JsonSchema {
  return {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: dataSchema,
      meta: { type: "object", additionalProperties: true },
      error: { type: "null" },
    },
  };
}

const ERROR_ENVELOPE: JsonSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: { type: "null" },
    meta: { type: "null" },
    error: { type: "object", additionalProperties: true },
  },
};

const ERROR_RESPONSE = {
  description: "Error",
  content: { "application/json": { schema: ERROR_ENVELOPE } },
};

const ID_PARAM = { name: "id", in: "path", required: true, schema: { type: "string" } };

export class OpenApiBuilder {
  static build(
    adapter: BaseAdapter,
    routeConfig: RouteConfig,
    info: OpenApiConfig["info"] = {}
  ): Record<string, unknown> {
    const paths: Record<string, any> = {};

    for (const modelDef of adapter.getModels()) {
      const modelName = modelDef.name;
      if (!routeConfig.isModelEnabled(modelName)) continue;

      const prefix = routeConfig.getModelPrefix(modelName);
      const omitFields = adapter.getOmitFields(modelName);
      const getEnum: EnumLookup = (name) => adapter.getEnum(name);
      const softDeleteField = adapter.getSoftDeleteField(modelName);

      const recordSchema = buildRecordSchema(modelDef, omitFields, getEnum);
      const writableFields = getWritableFields(modelDef, softDeleteField);
      const createBody = buildBodySchema(writableFields, getEnum);
      const updateBody = buildBodySchema(
        writableFields.map((f) => ({ ...f, isRequired: false })),
        getEnum
      );

      const idPath = `${prefix}/{id}`;
      paths[prefix] ??= {};
      paths[idPath] ??= {};

      if (routeConfig.isRouteEnabled(modelName, "findAll")) {
        paths[prefix].get = {
          tags: [modelName],
          summary: `List ${modelName} records (paginated)`,
          parameters: [
            { name: "page", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "string" } },
            { name: "searchBy", in: "query", schema: { type: "string" } },
            { name: "searchValue", in: "query", schema: { type: "string" } },
            { name: "sortBy", in: "query", schema: { type: "string" } },
            {
              name: "sortOrder",
              in: "query",
              schema: { type: "string", enum: ["asc", "desc"] },
            },
            {
              name: "filters",
              in: "query",
              schema: { type: "string" },
              description: "JSON-encoded filter object, e.g. {\"age\":{\"gte\":18}}",
            },
            {
              name: "include",
              in: "query",
              schema: { type: "string" },
              description: "Comma-separated relation names",
            },
            {
              name: "fields",
              in: "query",
              schema: { type: "string" },
              description: "Comma-separated field names to project the response to",
            },
          ],
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: successEnvelope({ type: "array", items: recordSchema }),
                },
              },
            },
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "findById")) {
        paths[idPath].get = {
          tags: [modelName],
          summary: `Get a single ${modelName} by id`,
          parameters: [
            ID_PARAM,
            { name: "include", in: "query", schema: { type: "string" } },
            { name: "fields", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Success",
              content: { "application/json": { schema: successEnvelope(recordSchema) } },
            },
            "404": ERROR_RESPONSE,
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "create")) {
        paths[prefix].post = {
          tags: [modelName],
          summary: `Create a ${modelName}`,
          requestBody: {
            required: true,
            content: { "application/json": { schema: createBody } },
          },
          responses: {
            "201": {
              description: "Created",
              content: { "application/json": { schema: successEnvelope(recordSchema) } },
            },
            "400": ERROR_RESPONSE,
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "update")) {
        paths[idPath].patch = {
          tags: [modelName],
          summary: `Update a ${modelName}`,
          parameters: [ID_PARAM],
          requestBody: {
            required: true,
            content: { "application/json": { schema: updateBody } },
          },
          responses: {
            "200": {
              description: "Success",
              content: { "application/json": { schema: successEnvelope(recordSchema) } },
            },
            "400": ERROR_RESPONSE,
            "404": ERROR_RESPONSE,
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "delete")) {
        paths[idPath].delete = {
          tags: [modelName],
          summary: softDeleteField ? `Soft-delete a ${modelName}` : `Delete a ${modelName}`,
          parameters: [ID_PARAM],
          responses: {
            "200": {
              description: "Success",
              content: { "application/json": { schema: successEnvelope(recordSchema) } },
            },
            "404": ERROR_RESPONSE,
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "findDeleted")) {
        paths[`${prefix}/deleted`] = {
          get: {
            tags: [modelName],
            summary: `List soft-deleted ${modelName} records`,
            parameters: [
              { name: "page", in: "query", schema: { type: "string" } },
              { name: "limit", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: successEnvelope({ type: "array", items: recordSchema }),
                  },
                },
              },
              "400": ERROR_RESPONSE,
            },
          },
        };
      }

      if (routeConfig.isRouteEnabled(modelName, "restore")) {
        paths[`${idPath}/restore`] = {
          patch: {
            tags: [modelName],
            summary: `Restore a soft-deleted ${modelName}`,
            parameters: [ID_PARAM],
            responses: {
              "200": {
                description: "Success",
                content: { "application/json": { schema: successEnvelope(recordSchema) } },
              },
              "400": ERROR_RESPONSE,
            },
          },
        };
      }

      if (Object.keys(paths[prefix]).length === 0) delete paths[prefix];
      if (Object.keys(paths[idPath]).length === 0) delete paths[idPath];
    }

    return {
      openapi: "3.0.3",
      info: {
        title: info?.title ?? "apiform API",
        version: info?.version ?? "1.0.0",
        ...(info?.description ? { description: info.description } : {}),
      },
      paths,
    };
  }
}
