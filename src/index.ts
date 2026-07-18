import Fastify, { type FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { PrismaAdapter } from "./adapters/prisma/prisma.adapter";
import { RouteGenerator } from "./router/route.generator";
import type { ApiFormConfig, RateLimitConfig } from "./types/config.types";

type CustomRouteHandler = (fastify: FastifyInstance) => void | Promise<void>;

export class ApiForm {
  private adapter: PrismaAdapter;
  private generator: RouteGenerator;
  private fastify: FastifyInstance;
  private customRoutes: CustomRouteHandler[] = [];
  private config: ApiFormConfig;

  constructor(client: any, config: ApiFormConfig = {}) {
    this.fastify = Fastify({ logger: true });
    this.adapter = new PrismaAdapter(client, config.schemaPath);
    this.generator = new RouteGenerator(this.adapter, config);
    this.config = config;
  }

  private buildRateLimitConfig(config: RateLimitConfig) {
    return {
      max: config.max,
      timeWindow: config.timeWindow * 1000, // convert seconds to ms
    };
  }

  addRoutes(handler: CustomRouteHandler): this {
    this.customRoutes.push(handler);
    return this;
  }

  async start(port: number = 3000): Promise<void> {
    await this.adapter.connect();

    // Register global rate limit if configured
    if (this.config.rateLimit) {
      await this.fastify.register(fastifyRateLimit, {
        global: true,
        ...this.buildRateLimitConfig(this.config.rateLimit),
        errorResponseBuilder: () => ({
          success: false,
          message: "RATE_LIMIT_EXCEEDED",
          data: null,
          meta: null,
          error: { code: "TOO_MANY_REQUESTS" },
        }),
      });
    }

    // Register OpenAPI/Swagger UI in "static" mode: the document is built
    // once from the schema/config, independent of Fastify's own route
    // schema system. Route handlers never get a `schema` attached, so this
    // can't change request validation or response serialization behavior.
    if (this.config.openapi?.enabled) {
      const document = this.generator.buildOpenApiDoc(this.config.openapi.info);
      await this.fastify.register(fastifySwagger, {
        mode: "static",
        specification: { document: document as any },
      });
      await this.fastify.register(fastifySwaggerUi, {
        routePrefix: this.config.openapi.path ?? "/docs",
      });
    }

    this.generator.applyModelConfigs();
    await this.generator.register(this.fastify);

    for (const handler of this.customRoutes) {
      await handler(this.fastify);
    }

    await this.fastify.listen({ port, host: "0.0.0.0" });
  }

  async stop(): Promise<void> {
    await this.fastify.close();
    await this.adapter.disconnect();
  }

  getInstance(): FastifyInstance {
    return this.fastify;
  }
}

// Exports
export { PrismaAdapter } from "./adapters/prisma/prisma.adapter";
export { RouteGenerator } from "./router/route.generator";
export { CrudEngine } from "./core/crud.engine";
export { ResponseFormatter } from "./core/response.formatter";
export { ErrorHandler } from "./core/error.handler";
export { SoftDeleteManager } from "./core/soft-delete.manager";
export { RbacManager } from "./core/rbac.manager";
export { OpenApiBuilder } from "./router/openapi.builder";
export type {
  ApiFormConfig,
  ModelRouteConfig,
  RouteOptions,
  RateLimitConfig,
  RbacConfig,
  OpenApiConfig,
} from "./types/config.types";
export type {
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  PaginationMeta,
} from "./types/response.types";
export type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  ModelHooks,
  HookContext,
  HookRuntime,
  BeforeCreateHook,
  AfterCreateHook,
  BeforeUpdateHook,
  AfterUpdateHook,
  BeforeDeleteHook,
  AfterDeleteHook,
  BeforeFindAllHook,
  AfterFindAllHook,
  BeforeFindByIdHook,
  AfterFindByIdHook,
} from "./types/crud.types";
export type {
  ModelDefinition,
  ModelField,
  EnumDefinition,
  SchemaDefinition,
  IAdapter,
} from "./types/adapter.types";
