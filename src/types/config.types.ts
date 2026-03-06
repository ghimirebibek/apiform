import type { FastifyRequest, FastifyReply } from "fastify";

export type MiddlewareFunction = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void;

export interface RateLimitConfig {
  max: number;
  timeWindow: number;
}

export interface RouteOptions {
  enabled?: boolean;
  middleware?: MiddlewareFunction[];
  roles?: string[];
  rateLimit?: RateLimitConfig;
}

export interface RbacConfig {
  rolesPath?: string;
  globalRoles?: string[];
}

export interface ModelRouteConfig {
  create?: RouteOptions;
  findAll?: RouteOptions;
  findById?: RouteOptions;
  update?: RouteOptions;
  delete?: RouteOptions;
  restore?: RouteOptions;
  findDeleted?: RouteOptions;
  prefix?: string;
  softDelete?: boolean | string;
}

export interface ApiFormConfig {
  models?: Record<string, ModelRouteConfig | boolean>;
  globalPrefix?: string;
  globalMiddleware?: MiddlewareFunction[];
  schemaPath?: string;
  rbac?: RbacConfig;
  rateLimit?: RateLimitConfig;
}
