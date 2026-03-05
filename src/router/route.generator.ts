import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { CrudEngine } from "../core/crud.engine";
import { RouteConfig } from "./route.config";
import { MiddlewareBinder } from "./middleware.binder";
import type { PrismaAdapter } from "../adapters/prisma/prisma.adapter";
import type { ApiFormConfig } from "../types/config.types";
import { ErrorHandler } from "../core/error.handler";

export class RouteGenerator {
  private engine: CrudEngine;
  private config: RouteConfig;
  private adapter: PrismaAdapter;
  private rawConfig: ApiFormConfig;

  constructor(adapter: PrismaAdapter, config: ApiFormConfig = {}) {
    this.adapter = adapter;
    this.engine = new CrudEngine(adapter);
    this.config = new RouteConfig(config);
    this.rawConfig = config;

    const modelConfigs: Record<string, any> = {};
    if (config.models) {
      for (const [key, value] of Object.entries(config.models)) {
        if (typeof value === "object" && value !== null) {
          modelConfigs[key] = value;
        }
      }
    }
    this.adapter.setModelConfigs(modelConfigs);
  }

  private send(reply: FastifyReply, result: any): void {
    if (result.success === false && result.error?.code) {
      const status = ErrorHandler.getHttpStatus(result.error.code);
      reply.status(status).send(result);
    } else {
      reply.send(result);
    }
  }

  applyModelConfigs(): void {
    const modelConfigs: Record<string, any> = {};
    if (this.rawConfig.models) {
      for (const [key, value] of Object.entries(this.rawConfig.models)) {
        if (typeof value === "object" && value !== null) {
          modelConfigs[key] = value;
        }
      }
    }
    this.adapter.setModelConfigs(modelConfigs);
  }

  async register(fastify: FastifyInstance): Promise<void> {
    const models = this.adapter.getModels();
    const globalMiddleware = this.config.getGlobalMiddleware();

    for (const model of models) {
      const modelName = model.name;
      if (!this.config.isModelEnabled(modelName)) continue;

      const prefix = this.config.getModelPrefix(modelName);
      const modelConfig = this.config.getModelConfig(modelName);

      // GET /prefix — findAll
      if (this.config.isRouteEnabled(modelName, "findAll")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.findAll
        );
        fastify.get(
          prefix,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const query = request.query as Record<string, string>;

            const includeParam = query.include
              ? Object.fromEntries(
                  query.include.split(",").map((r: string) => [r.trim(), true])
                )
              : undefined;

            const result = await this.engine.findAll(modelName, {
              page: query.page ? parseInt(query.page) : 1,
              limit: query.limit ? parseInt(query.limit) : 10,
              searchBy: query.searchBy,
              searchValue: query.searchValue,
              sortBy: query.sortBy,
              sortOrder: query.sortOrder as "asc" | "desc" | undefined,
              filters: query.filters ? JSON.parse(query.filters) : {},
              include: includeParam,
            });
            this.send(reply, result);
          }
        );
      }

      // GET /prefix/deleted — findDeleted
      if (this.config.isRouteEnabled(modelName, "findDeleted")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.findDeleted
        );
        fastify.get(
          `${prefix}/deleted`,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const query = request.query as Record<string, string>;
            try {
              const result = await this.adapter.findDeleted(modelName, {
                page: query.page ? parseInt(query.page) : 1,
                limit: query.limit ? parseInt(query.limit) : 10,
              });
              reply.send({
                success: true,
                message: `${modelName.toUpperCase()}S_DELETED_RETRIEVED_SUCCESSFULLY`,
                data: result.data,
                meta: result.meta,
                error: null,
              });
            } catch {
              reply.status(400).send({
                success: false,
                message: "SOFT_DELETE_NOT_SUPPORTED",
                data: null,
                meta: null,
                error: { code: "BAD_REQUEST" },
              });
            }
          }
        );
      }

      // GET /prefix/:id — findById
      if (this.config.isRouteEnabled(modelName, "findById")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.findById
        );
        fastify.get(
          `${prefix}/:id`,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const { id } = request.params as { id: string };
            const query = request.query as Record<string, string>;
            const includeParam = query.include
              ? Object.fromEntries(
                  query.include.split(",").map((r: string) => [r.trim(), true])
                )
              : undefined;

            const result = await this.engine.findById(
              modelName,
              id,
              includeParam
            );
            this.send(reply, result);
          }
        );
      }

      // POST /prefix — create
      if (this.config.isRouteEnabled(modelName, "create")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.create
        );
        fastify.post(
          prefix,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const result = await this.engine.create(modelName, {
              data: request.body as Record<string, unknown>,
            });
            if (result.success === false) {
              this.send(reply, result);
            } else {
              reply.status(201).send(result);
            }
          }
        );
      }

      // PATCH /prefix/:id — update
      if (this.config.isRouteEnabled(modelName, "update")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.update
        );
        fastify.patch(
          `${prefix}/:id`,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const { id } = request.params as { id: string };
            const result = await this.engine.update(modelName, {
              where: { id },
              data: request.body as Record<string, unknown>,
            });
            this.send(reply, result);
          }
        );
      }

      // DELETE /prefix/:id — delete or soft delete
      if (this.config.isRouteEnabled(modelName, "delete")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.delete
        );
        fastify.delete(
          `${prefix}/:id`,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const { id } = request.params as { id: string };
            const result = await this.engine.delete(modelName, {
              where: { id },
            });
            this.send(reply, result);
          }
        );
      }

      // PATCH /prefix/:id/restore — restore soft deleted record
      if (this.config.isRouteEnabled(modelName, "restore")) {
        const middlewares = MiddlewareBinder.bind(
          globalMiddleware,
          modelConfig.restore
        );
        fastify.patch(
          `${prefix}/:id/restore`,
          async (request: FastifyRequest, reply: FastifyReply) => {
            const canProceed = await MiddlewareBinder.run(
              middlewares,
              request,
              reply
            );
            if (!canProceed) return;

            const { id } = request.params as { id: string };
            try {
              const result = await this.adapter.restore(modelName, id);
              reply.send({
                success: true,
                message: `${modelName.toUpperCase()}_RESTORED_SUCCESSFULLY`,
                data: result.data,
                meta: null,
                error: null,
              });
            } catch {
              reply.status(400).send({
                success: false,
                message: "SOFT_DELETE_NOT_SUPPORTED",
                data: null,
                meta: null,
                error: { code: "BAD_REQUEST" },
              });
            }
          }
        );
      }
    }
  }
}
