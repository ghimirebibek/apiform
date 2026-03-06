import { describe, it, expect, mock } from "bun:test";
import { RbacManager } from "../src/core/rbac.manager";
import type { FastifyRequest, FastifyReply } from "fastify";

const mockReply = () => {
  const reply: any = {
    status: mock(() => reply),
    send: mock(() => reply),
  };
  return reply as FastifyReply;
};

const mockRequest = (roles: string[] | string | null, path = "user.roles") => {
  const req: any = { user: { roles } };
  return req as FastifyRequest;
};

describe("RbacManager", () => {
  it("should allow access when no roles required", async () => {
    const rbac = new RbacManager({});
    const reply = mockReply();
    const request = mockRequest([]);

    const allowed = await rbac.checkAccess(request, reply, []);
    expect(allowed).toBe(true);
  });

  it("should allow access when user has required role", async () => {
    const rbac = new RbacManager({ rolesPath: "user.roles" });
    const reply = mockReply();
    const request = mockRequest(["admin", "user"]);

    const allowed = await rbac.checkAccess(request, reply, ["admin"]);
    expect(allowed).toBe(true);
  });

  it("should deny access when user lacks required role", async () => {
    const rbac = new RbacManager({ rolesPath: "user.roles" });
    const reply = mockReply();
    const request = mockRequest(["user"]);

    const allowed = await rbac.checkAccess(request, reply, ["admin"]);
    expect(allowed).toBe(false);
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("should use global roles when no route roles specified", async () => {
    const rbac = new RbacManager({ globalRoles: ["user"] });
    const reply = mockReply();
    const request = mockRequest(["user"]);

    const allowed = await rbac.checkAccess(request, reply, undefined);
    expect(allowed).toBe(true);
  });

  it("should override global roles with route roles", async () => {
    const rbac = new RbacManager({ globalRoles: ["user"] });
    const reply = mockReply();
    const request = mockRequest(["user"]);

    const allowed = await rbac.checkAccess(request, reply, ["admin"]);
    expect(allowed).toBe(false);
  });

  it("should handle single string role", async () => {
    const rbac = new RbacManager({ rolesPath: "user.roles" });
    const reply = mockReply();
    const request = mockRequest("admin");

    const allowed = await rbac.checkAccess(request, reply, ["admin"]);
    expect(allowed).toBe(true);
  });

  it("should handle custom roles path", async () => {
    const rbac = new RbacManager({ rolesPath: "auth.roles" });
    const req: any = { auth: { roles: ["admin"] } };
    const reply = mockReply();

    const allowed = await rbac.checkAccess(req, reply, ["admin"]);
    expect(allowed).toBe(true);
  });

  it("should return empty roles when path not found", async () => {
    const rbac = new RbacManager({ rolesPath: "user.roles" });
    const req: any = {};
    const reply = mockReply();

    const allowed = await rbac.checkAccess(req, reply, ["admin"]);
    expect(allowed).toBe(false);
  });
});
