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
  HookContext,
  HookRuntime,
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

  private buildHookContext(model: string, runtime?: HookRuntime): HookContext {
    return { model, request: runtime?.request as HookContext["request"] };
  }

  async findAll<T = unknown>(
    model: string,
    options: FindAllOptions = {},
    runtime?: HookRuntime
  ): Promise<ApiResponse<T[]>> {
    try {
      const hooks = runtime?.hooks;
      const ctx = this.buildHookContext(model, runtime);

      let opts = options;
      if (hooks?.beforeFindAll) {
        opts = await hooks.beforeFindAll(opts, ctx);
      }

      const result = await this.adapter.findAll(model, opts);
      const page = opts.page ?? 1;
      const limit = opts.limit ?? 10;
      let data: unknown[] = FieldMasker.select(result.data ?? [], opts.fields) as unknown[];

      if (hooks?.afterFindAll) {
        data = await hooks.afterFindAll(data, ctx);
      }

      return ResponseFormatter.paginate<T>(
        data as T[],
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
    fields?: string[],
    runtime?: HookRuntime
  ): Promise<ApiResponse<T>> {
    try {
      const hooks = runtime?.hooks;
      const ctx = this.buildHookContext(model, runtime);

      if (hooks?.beforeFindById) {
        await hooks.beforeFindById(id, ctx);
      }

      const result = await this.adapter.findById(model, id, include);

      if (!result.data) {
        return ResponseFormatter.error(
          `${model.toUpperCase()}_NOT_FOUND`,
          ErrorCode.NOT_FOUND
        );
      }

      let data: unknown = FieldMasker.select(result.data, fields);
      if (hooks?.afterFindById) {
        data = await hooks.afterFindById(data, ctx);
      }

      return ResponseFormatter.success<T>(
        data as T,
        ResponseFormatter.formatMessage("findById", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async create<T = unknown>(
    model: string,
    options: CreateOptions,
    runtime?: HookRuntime
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

      const hooks = runtime?.hooks;
      const ctx = this.buildHookContext(model, runtime);
      if (hooks?.beforeCreate) {
        // Runs after whitelist stripping, so a hook may safely add
        // server-derived fields (tenantId, hashed password, audit ids)
        // that would otherwise be rejected as non-writable client input.
        data = await hooks.beforeCreate(data, ctx);
      }

      const result = await this.adapter.create(model, { ...options, data });
      let responseData: unknown = result.data;
      if (hooks?.afterCreate) {
        responseData = await hooks.afterCreate(responseData, ctx);
      }

      return ResponseFormatter.success<T>(
        responseData as T,
        ResponseFormatter.formatMessage("create", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async update<T = unknown>(
    model: string,
    options: UpdateOptions,
    runtime?: HookRuntime
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

      const hooks = runtime?.hooks;
      const ctx = this.buildHookContext(model, runtime);
      if (hooks?.beforeUpdate) {
        data = await hooks.beforeUpdate(data, ctx);
      }

      const result = await this.adapter.update(model, { ...options, data });
      let responseData: unknown = result.data;
      if (hooks?.afterUpdate) {
        responseData = await hooks.afterUpdate(responseData, ctx);
      }

      return ResponseFormatter.success<T>(
        responseData as T,
        ResponseFormatter.formatMessage("update", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async delete<T = unknown>(
    model: string,
    options: DeleteOptions,
    runtime?: HookRuntime
  ): Promise<ApiResponse<T>> {
    try {
      const hooks = runtime?.hooks;
      const ctx = this.buildHookContext(model, runtime);

      if (hooks?.beforeDelete) {
        await hooks.beforeDelete(ctx);
      }

      const result = await this.adapter.delete(model, options);
      let data: unknown = result.data;
      if (hooks?.afterDelete) {
        data = await hooks.afterDelete(data, ctx);
      }

      return ResponseFormatter.success<T>(
        data as T,
        ResponseFormatter.formatMessage("delete", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }
}
