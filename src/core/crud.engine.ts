import type { BaseAdapter } from "../adapters/base.adapter";
import { ResponseFormatter } from "./response.formatter";
import { ErrorHandler } from "./error.handler";
import { ErrorCode } from "../types/response.types";
import type { ApiResponse } from "../types/response.types";
import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
} from "../types/crud.types";
import { Validator } from "./validator";
import { FieldMasker } from "./field.masker";
import type { ModelDefinition } from "../types/adapter.types";

export class CrudEngine {
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter) {
    this.adapter = adapter;
  }

  // Fields a client may set on create/update: excludes the PK, any
  // @updatedAt field, any field auto-defaulted via @default(now()) (e.g.
  // createdAt — regardless of what it's actually named), and the model's
  // resolved soft-delete field (which itself may be renamed via config).
  private getWritableFields(model: string, modelDef: ModelDefinition) {
    const softDeleteField = this.adapter.getSoftDeleteField(model);
    return modelDef.fields.filter((f) => {
      if (f.isId) return false;
      if (f.isUpdatedAt) return false;
      if (f.default === "now()") return false;
      if (softDeleteField && f.name === softDeleteField) return false;
      return true;
    });
  }

  async findAll<T = unknown>(
    model: string,
    options: FindAllOptions = {}
  ): Promise<ApiResponse<T[]>> {
    try {
      const result = await this.adapter.findAll(model, options);
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;
      const data = FieldMasker.select(result.data ?? [], options.fields) as T[];

      return ResponseFormatter.paginate<T>(
        data,
        model,
        page,
        limit,
        result.meta?.total ?? 0
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async findOne<T = unknown>(
    model: string,
    options: FindOneOptions
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.adapter.findOne(model, options);

      if (!result.data) {
        return ResponseFormatter.error(
          `${model.toUpperCase()}_NOT_FOUND`,
          ErrorCode.NOT_FOUND
        );
      }

      return ResponseFormatter.success<T>(
        result.data as T,
        ResponseFormatter.formatMessage("findById", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async findById<T = unknown>(
    model: string,
    id: string | number,
    include?: Record<string, boolean>,
    fields?: string[]
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.adapter.findById(model, id, include);

      if (!result.data) {
        return ResponseFormatter.error(
          `${model.toUpperCase()}_NOT_FOUND`,
          ErrorCode.NOT_FOUND
        );
      }

      return ResponseFormatter.success<T>(
        FieldMasker.select(result.data, fields) as T,
        ResponseFormatter.formatMessage("findById", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async create<T = unknown>(
    model: string,
    options: CreateOptions
  ): Promise<ApiResponse<T>> {
    try {
      const modelDef = this.adapter.getModel(model);
      let data: Record<string, unknown> = options.data;
      if (modelDef) {
        const writableFields = this.getWritableFields(model, modelDef);
        const schema = Validator.buildSchema(writableFields, (name) =>
          this.adapter.getEnum(name)
        );
        const validation = Validator.validate(schema, options.data);
        if (!validation.success) {
          return validation.error as any;
        }
        // Forward the Zod-parsed, whitelist-stripped data — not the raw
        // request body — so fields outside the writable set (id, timestamps,
        // anything the model doesn't expose) can never reach the database.
        data = validation.data as Record<string, unknown>;
      }

      const result = await this.adapter.create(model, { ...options, data });
      return ResponseFormatter.success<T>(
        result.data as T,
        ResponseFormatter.formatMessage("create", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async update<T = unknown>(
    model: string,
    options: UpdateOptions
  ): Promise<ApiResponse<T>> {
    try {
      const modelDef = this.adapter.getModel(model);
      let data: Record<string, unknown> = options.data;
      if (modelDef) {
        const writableFields = this.getWritableFields(model, modelDef).map(
          (f) => ({ ...f, isRequired: false }) // all fields optional on update
        );
        const schema = Validator.buildSchema(writableFields, (name) =>
          this.adapter.getEnum(name)
        );
        const validation = Validator.validate(schema, options.data);
        if (!validation.success) {
          return validation.error as any;
        }
        data = validation.data as Record<string, unknown>;
      }

      const result = await this.adapter.update(model, { ...options, data });
      return ResponseFormatter.success<T>(
        result.data as T,
        ResponseFormatter.formatMessage("update", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async delete<T = unknown>(
    model: string,
    options: DeleteOptions
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.adapter.delete(model, options);

      return ResponseFormatter.success<T>(
        result.data as T,
        ResponseFormatter.formatMessage("delete", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }
}
