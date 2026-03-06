import type { FastifyRequest, FastifyReply } from "fastify";
import type { RbacConfig } from "../types/config.types";
import { ResponseFormatter } from "./response.formatter";
import { ErrorCode } from "../types/response.types";

export class RbacManager {
  private config: RbacConfig;

  constructor(config: RbacConfig = {}) {
    this.config = config;
  }

  // Extract roles from request using dot notation path
  private extractRoles(request: FastifyRequest): string[] {
    const path = this.config.rolesPath ?? "user.roles";
    const parts = path.split(".");
    let current: any = request;

    for (const part of parts) {
      if (current === null || current === undefined) return [];
      current = current[part];
    }

    if (Array.isArray(current)) return current;
    if (typeof current === "string") return [current];
    return [];
  }

  // Check if user has at least one of the required roles
  hasRole(request: FastifyRequest, requiredRoles: string[]): boolean {
    if (requiredRoles.length === 0) return true;
    const userRoles = this.extractRoles(request);
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  // Build effective roles for a route — merge global and route-level roles
  getEffectiveRoles(routeRoles?: string[]): string[] {
    const globalRoles = this.config.globalRoles ?? [];

    // If route has explicit roles, they override global
    if (routeRoles && routeRoles.length > 0) return routeRoles;

    // Otherwise use global roles
    return globalRoles;
  }

  // Check access and send 403 if denied — returns true if allowed
  async checkAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    routeRoles?: string[],
  ): Promise<boolean> {
    const effectiveRoles = this.getEffectiveRoles(routeRoles);

    // No roles required — allow
    if (effectiveRoles.length === 0) return true;

    // Check if user has required role
    if (this.hasRole(request, effectiveRoles)) return true;

    // Deny with 403
    reply
      .status(403)
      .send(
        ResponseFormatter.error(
          "You do not have permission to access this resource",
          ErrorCode.FORBIDDEN,
        ),
      );
    return false;
  }
}
