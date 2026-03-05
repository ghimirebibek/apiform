import type {
  SuccessResponse,
  ErrorResponse,
  PaginationMeta,
} from "../types/response.types";
import { ErrorCode } from "../types/response.types";

export class ResponseFormatter {
  static success<T>(
    data: T,
    message: string,
    meta: PaginationMeta | null = null
  ): SuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      meta,
      error: null,
    };
  }

  static error(
    message: string,
    code: ErrorCode,
    details?: unknown
  ): ErrorResponse {
    return {
      success: false,
      message,
      data: null,
      meta: null,
      error: {
        code,
        details,
      },
    };
  }

  static paginate<T>(
    data: T[],
    modelName: string,
    page: number,
    limit: number,
    total: number
  ): SuccessResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    const message = `${modelName.toUpperCase()}S_RETRIEVED_SUCCESSFULLY`;
    return this.success<T[]>(data, message, meta);
  }

  static formatMessage(action: string, modelName: string): string {
    const name = modelName.toUpperCase();
    const messages: Record<string, string> = {
      create: `${name}_CREATED_SUCCESSFULLY`,
      findAll: `${name}S_RETRIEVED_SUCCESSFULLY`,
      findById: `${name}_RETRIEVED_SUCCESSFULLY`,
      update: `${name}_UPDATED_SUCCESSFULLY`,
      delete: `${name}_DELETED_SUCCESSFULLY`,
    };
    return messages[action] ?? `${name}_OPERATION_SUCCESSFUL`;
  }
}
