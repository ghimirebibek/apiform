import type { FastifyRequest, FastifyReply } from "fastify";

export type MiddlewareFunction = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void> | void;

export interface RouteOptions {
  enabled?: boolean;
  middleware?: MiddlewareFunction[];
  prefix?: string;
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
  softDelete?: boolean | string; // true = use deletedAt, string = custom field name
}

export interface ApiFormConfig {
  models?: Record<string, ModelRouteConfig | boolean>;
  globalPrefix?: string;
  globalMiddleware?: MiddlewareFunction[];
  schemaPath?: string;
}
