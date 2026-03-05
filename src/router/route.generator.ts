import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { CrudEngine } from "../core/crud.engine";
import { RouteConfig } from "./route.config";
import { MiddlewareBinder } from "./middleware.binder";
import type { BaseAdapter } from "../adapters/base.adapter";
import type { ApiFormConfig } from "../types/config.types";

export class RouteGenerator {
  private engine: CrudEngine;
  private config: RouteConfig;
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter, config: ApiFormConfig = {}) {
    this.adapter = adapter;
    this.engine = new CrudEngine(adapter);
    this.config = new RouteConfig(config);
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
            const result = await this.engine.findAll(modelName, {
              page: query.page ? parseInt(query.page) : 1,
              limit: query.limit ? parseInt(query.limit) : 10,
              searchBy: query.searchBy,
              searchValue: query.searchValue,
              sortBy: query.sortBy,
              sortOrder: query.sortOrder as "asc" | "desc" | undefined,
              filters: query.filters ? JSON.parse(query.filters) : {},
            });

            reply.send(result);
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
            const result = await this.engine.findById(modelName, id);
            reply.send(result);
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
            reply.status(201).send(result);
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
            reply.send(result);
          }
        );
      }

      // DELETE /prefix/:id — delete
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
            reply.send(result);
          }
        );
      }
    }
  }
}
