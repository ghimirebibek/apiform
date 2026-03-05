import { describe, it, expect } from "bun:test";
import { RouteConfig } from "../src/router/route.config";

describe("RouteConfig", () => {
  it("should return default global prefix", () => {
    const config = new RouteConfig();
    expect(config.getGlobalPrefix()).toBe("/api");
  });

  it("should return custom global prefix", () => {
    const config = new RouteConfig({ globalPrefix: "/v1" });
    expect(config.getGlobalPrefix()).toBe("/v1");
  });

  it("should return empty global middleware by default", () => {
    const config = new RouteConfig();
    expect(config.getGlobalMiddleware()).toEqual([]);
  });

  it("should enable all routes by default when model is true", () => {
    const config = new RouteConfig({ models: { user: true } });

    expect(config.isRouteEnabled("user", "create")).toBe(true);
    expect(config.isRouteEnabled("user", "findAll")).toBe(true);
    expect(config.isRouteEnabled("user", "findById")).toBe(true);
    expect(config.isRouteEnabled("user", "update")).toBe(true);
    expect(config.isRouteEnabled("user", "delete")).toBe(true);
  });

  it("should disable all routes when model is false", () => {
    const config = new RouteConfig({ models: { user: false } });

    expect(config.isModelEnabled("user")).toBe(false);
    expect(config.isRouteEnabled("user", "create")).toBe(false);
    expect(config.isRouteEnabled("user", "findAll")).toBe(false);
    expect(config.isRouteEnabled("user", "findById")).toBe(false);
    expect(config.isRouteEnabled("user", "update")).toBe(false);
    expect(config.isRouteEnabled("user", "delete")).toBe(false);
  });

  it("should disable a specific route", () => {
    const config = new RouteConfig({
      models: {
        user: {
          delete: { enabled: false },
        },
      },
    });

    expect(config.isRouteEnabled("user", "create")).toBe(true);
    expect(config.isRouteEnabled("user", "delete")).toBe(false);
  });

  it("should generate correct model prefix", () => {
    const config = new RouteConfig({
      globalPrefix: "/api",
      models: { user: true },
    });

    expect(config.getModelPrefix("user")).toBe("/api/users");
  });

  it("should use custom model prefix", () => {
    const config = new RouteConfig({
      globalPrefix: "/api",
      models: {
        user: { prefix: "/members" },
      },
    });

    expect(config.getModelPrefix("user")).toBe("/api/members");
  });

  it("should be case insensitive for model names", () => {
    const config = new RouteConfig({ models: { user: true } });

    expect(config.isModelEnabled("User")).toBe(true);
    expect(config.isModelEnabled("USER")).toBe(true);
    expect(config.isModelEnabled("user")).toBe(true);
  });
});
