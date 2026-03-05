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
  prefix?: string;
}

export interface ApiFormConfig {
  models?: Record<string, ModelRouteConfig | boolean>;
  globalPrefix?: string;
  globalMiddleware?: MiddlewareFunction[];
  schemaPath?: string;
}
