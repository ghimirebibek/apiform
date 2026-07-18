import type { FastifyRequest } from "fastify";
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
  include?: Record<string, boolean>;
  fields?: string[];
}

export interface FindOneOptions {
  where: Record<string, unknown>;
  include?: Record<string, boolean>;
  fields?: string[];
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

// Lifecycle hooks let a consumer inject logic (hash a password, enrich a
// record with server-derived fields, scope a query to a tenant, fire a
// webhook) without reimplementing an entire route via addRoutes(). Before-*
// hooks for create/update run *after* the writable-field whitelist has
// already stripped the request body, so a hook can safely add fields
// (e.g. tenantId, hashedPassword) that bypass client-writability checks —
// the hook is trusted first-party code, not client input.
export interface HookContext {
  model: string;
  request: FastifyRequest;
}

export type BeforeCreateHook = (
  data: Record<string, unknown>,
  ctx: HookContext
) => Record<string, unknown> | Promise<Record<string, unknown>>;
export type AfterCreateHook = (
  record: unknown,
  ctx: HookContext
) => unknown | Promise<unknown>;
export type BeforeUpdateHook = (
  data: Record<string, unknown>,
  ctx: HookContext
) => Record<string, unknown> | Promise<Record<string, unknown>>;
export type AfterUpdateHook = (
  record: unknown,
  ctx: HookContext
) => unknown | Promise<unknown>;
export type BeforeDeleteHook = (ctx: HookContext) => void | Promise<void>;
export type AfterDeleteHook = (
  record: unknown,
  ctx: HookContext
) => unknown | Promise<unknown>;
export type BeforeFindAllHook = (
  options: FindAllOptions,
  ctx: HookContext
) => FindAllOptions | Promise<FindAllOptions>;
export type AfterFindAllHook = (
  records: unknown[],
  ctx: HookContext
) => unknown[] | Promise<unknown[]>;
export type BeforeFindByIdHook = (
  id: string | number,
  ctx: HookContext
) => void | Promise<void>;
export type AfterFindByIdHook = (
  record: unknown,
  ctx: HookContext
) => unknown | Promise<unknown>;

export interface ModelHooks {
  beforeCreate?: BeforeCreateHook;
  afterCreate?: AfterCreateHook;
  beforeUpdate?: BeforeUpdateHook;
  afterUpdate?: AfterUpdateHook;
  beforeDelete?: BeforeDeleteHook;
  afterDelete?: AfterDeleteHook;
  beforeFindAll?: BeforeFindAllHook;
  afterFindAll?: AfterFindAllHook;
  beforeFindById?: BeforeFindByIdHook;
  afterFindById?: AfterFindByIdHook;
}

export interface HookRuntime {
  hooks?: ModelHooks;
  request?: FastifyRequest;
}
