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

export class CrudEngine {
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter) {
    this.adapter = adapter;
  }

  async findAll<T = unknown>(
    model: string,
    options: FindAllOptions = {}
  ): Promise<ApiResponse<T[]>> {
    try {
      const result = await this.adapter.findAll(model, options);
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;

      return ResponseFormatter.paginate<T>(
        (result.data ?? []) as T[],
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
    id: string | number
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.adapter.findById(model, id);

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

  async create<T = unknown>(
    model: string,
    options: CreateOptions
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.adapter.create(model, options);

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
      const result = await this.adapter.update(model, options);

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
