import type { PaginationMeta } from "./response.types";

export interface FindAllOptions {
  page?: number;
  limit?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  searchBy?: string;
  searchValue?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, unknown>;
}

export interface FindOneOptions {
  where: Record<string, unknown>;
}

export interface CreateOptions<T = Record<string, unknown>> {
  data: T;
}

export interface UpdateOptions<T = Record<string, unknown>> {
  where: Record<string, unknown>;
  data: Partial<T>;
}

export interface DeleteOptions {
  where: Record<string, unknown>;
}

export interface CrudResult<T = unknown> {
  data: T | null;
  meta?: PaginationMeta | null;
}

export interface ICrudEngine {
  findAll(
    model: string,
    options: FindAllOptions
  ): Promise<CrudResult<unknown[]>>;
  findOne(model: string, options: FindOneOptions): Promise<CrudResult<unknown>>;
  findById(model: string, id: string | number): Promise<CrudResult<unknown>>;
  create(model: string, options: CreateOptions): Promise<CrudResult<unknown>>;
  update(model: string, options: UpdateOptions): Promise<CrudResult<unknown>>;
  delete(model: string, options: DeleteOptions): Promise<CrudResult<unknown>>;
}
