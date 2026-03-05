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
  findAll<T>(model: string, options: FindAllOptions): Promise<CrudResult<T[]>>;
  findOne<T>(model: string, options: FindOneOptions): Promise<CrudResult<T>>;
  findById<T>(model: string, id: string | number): Promise<CrudResult<T>>;
  create<T>(model: string, options: CreateOptions): Promise<CrudResult<T>>;
  update<T>(model: string, options: UpdateOptions): Promise<CrudResult<T>>;
  delete<T>(model: string, options: DeleteOptions): Promise<CrudResult<T>>;
}
