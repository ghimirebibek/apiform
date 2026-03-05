import type { BaseAdapter } from "../adapters/base.adapter";
import { ResponseFormatter } from "./response.formatter";
import { ErrorHandler } from "./error.handler";
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

  async findAll(
    model: string,
    options: FindAllOptions = {}
  ): Promise<ApiResponse<unknown[]>> {
    try {
      const result = await this.adapter.findAll(model, options);
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;

      return ResponseFormatter.paginate(
        result.data ?? [],
        model,
        page,
        limit,
        result.meta?.total ?? 0
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async findOne(
    model: string,
    options: FindOneOptions
  ): Promise<ApiResponse<unknown>> {
    try {
      const result = await this.adapter.findOne(model, options);

      if (!result.data) {
        return ResponseFormatter.error(
          `${model.toUpperCase()}_NOT_FOUND`,
          "NOT_FOUND" as any
        );
      }

      return ResponseFormatter.success(
        result.data,
        ResponseFormatter.formatMessage("findById", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async findById(
    model: string,
    id: string | number
  ): Promise<ApiResponse<unknown>> {
    try {
      const result = await this.adapter.findById(model, id);

      if (!result.data) {
        return ResponseFormatter.error(
          `${model.toUpperCase()}_NOT_FOUND`,
          "NOT_FOUND" as any
        );
      }

      return ResponseFormatter.success(
        result.data,
        ResponseFormatter.formatMessage("findById", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async create(
    model: string,
    options: CreateOptions
  ): Promise<ApiResponse<unknown>> {
    try {
      const result = await this.adapter.create(model, options);

      return ResponseFormatter.success(
        result.data,
        ResponseFormatter.formatMessage("create", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async update(
    model: string,
    options: UpdateOptions
  ): Promise<ApiResponse<unknown>> {
    try {
      const result = await this.adapter.update(model, options);

      return ResponseFormatter.success(
        result.data,
        ResponseFormatter.formatMessage("update", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }

  async delete(
    model: string,
    options: DeleteOptions
  ): Promise<ApiResponse<unknown>> {
    try {
      const result = await this.adapter.delete(model, options);

      return ResponseFormatter.success(
        result.data,
        ResponseFormatter.formatMessage("delete", model)
      );
    } catch (error) {
      return ErrorHandler.handle(error);
    }
  }
}
