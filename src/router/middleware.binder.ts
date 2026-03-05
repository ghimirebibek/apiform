import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { MiddlewareFunction, RouteOptions } from "../types/config.types";

export class MiddlewareBinder {
  static async run(
    middlewares: MiddlewareFunction[],
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<boolean> {
    for (const middleware of middlewares) {
      await middleware(request, reply);

      // if reply was sent by middleware, stop chain
      if (reply.sent) return false;
    }
    return true;
  }

  static bind(
    globalMiddleware: MiddlewareFunction[],
    routeOptions?: RouteOptions
  ): MiddlewareFunction[] {
    const routeMiddleware = routeOptions?.middleware ?? [];
    return [...globalMiddleware, ...routeMiddleware];
  }

  static register(
    fastify: FastifyInstance,
    middlewares: MiddlewareFunction[]
  ): void {
    for (const middleware of middlewares) {
      fastify.addHook("preHandler", async (request, reply) => {
        await middleware(request, reply);
      });
    }
  }
}
