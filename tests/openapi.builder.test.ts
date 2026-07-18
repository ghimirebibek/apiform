import { describe, it, expect } from "bun:test";
import { OpenApiBuilder } from "../src/router/openapi.builder";
import { RouteConfig } from "../src/router/route.config";
import { BaseAdapter } from "../src/adapters/base.adapter";
import type { EnumDefinition, ModelDefinition } from "../src/types/adapter.types";
import type {
  CrudResult,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  FindAllOptions,
  FindOneOptions,
} from "../src/types/crud.types";

const roleEnum: EnumDefinition = { name: "Role", values: ["ADMIN", "EDITOR", "VIEWER"] };

const userModel: ModelDefinition = {
  name: "User",
  fields: [
    { name: "id", type: "String", isRequired: true, isId: true, isUnique: false },
    { name: "name", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "password", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "role", type: "Role", isRequired: true, isId: false, isUnique: false },
    {
      name: "createdAt",
      type: "DateTime",
      isRequired: true,
      isId: false,
      isUnique: false,
      default: "now()",
    },
    {
      name: "deletedAt",
      type: "DateTime",
      isRequired: false,
      isId: false,
      isUnique: false,
    },
  ],
};

const postModel: ModelDefinition = {
  name: "Post",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    { name: "title", type: "String", isRequired: true, isId: false, isUnique: false },
  ],
};

class FakeAdapter extends BaseAdapter {
  constructor(
    models: ModelDefinition[],
    enums: EnumDefinition[] = [],
    private omitConfig: Record<string, string[]> = {},
    private softDeleteConfig: Record<string, string | null> = {}
  ) {
    super();
    this.models = models;
    this.enums = enums;
  }

  override getOmitFields(model: string): string[] {
    return this.omitConfig[model.toLowerCase()] ?? [];
  }

  override getSoftDeleteField(model: string): string | null {
    return this.softDeleteConfig[model.toLowerCase()] ?? null;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async findAll(_m: string, _o: FindAllOptions): Promise<CrudResult<unknown[]>> {
    return { data: [] };
  }
  async findOne(_m: string, _o: FindOneOptions): Promise<CrudResult<unknown>> {
    return { data: null };
  }
  async findById(): Promise<CrudResult<unknown>> {
    return { data: null };
  }
  async create(_m: string, o: CreateOptions): Promise<CrudResult<unknown>> {
    return { data: o.data };
  }
  async update(_m: string, o: UpdateOptions): Promise<CrudResult<unknown>> {
    return { data: o.data };
  }
  async delete(_m: string, _o: DeleteOptions): Promise<CrudResult<unknown>> {
    return { data: null };
  }
}

describe("OpenApiBuilder", () => {
  it("builds a path entry for every enabled CRUD route", () => {
    const adapter = new FakeAdapter([userModel], [roleEnum], {}, { user: "deletedAt" });
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;

    expect(doc.paths["/api/users"].get).toBeDefined();
    expect(doc.paths["/api/users"].post).toBeDefined();
    expect(doc.paths["/api/users/{id}"].get).toBeDefined();
    expect(doc.paths["/api/users/{id}"].patch).toBeDefined();
    expect(doc.paths["/api/users/{id}"].delete).toBeDefined();
  });

  it("omits paths for a disabled model entirely", () => {
    const adapter = new FakeAdapter([userModel]);
    const routeConfig = new RouteConfig({ models: { user: false } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;

    expect(doc.paths["/api/users"]).toBeUndefined();
    expect(doc.paths["/api/users/{id}"]).toBeUndefined();
  });

  it("does not include restore/findDeleted paths unless explicitly enabled (matches route registration defaults)", () => {
    const adapter = new FakeAdapter([userModel], [], {}, { user: "deletedAt" });
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;

    expect(doc.paths["/api/users/deleted"]).toBeUndefined();
    expect(doc.paths["/api/users/{id}/restore"]).toBeUndefined();
  });

  it("includes restore/findDeleted paths when explicitly enabled", () => {
    const adapter = new FakeAdapter([userModel], [], {}, { user: "deletedAt" });
    const routeConfig = new RouteConfig({
      models: {
        user: { restore: { enabled: true }, findDeleted: { enabled: true } },
      },
    });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;

    expect(doc.paths["/api/users/deleted"].get).toBeDefined();
    expect(doc.paths["/api/users/{id}/restore"].patch).toBeDefined();
  });

  it("excludes omit-configured fields from the response record schema", () => {
    const adapter = new FakeAdapter([userModel], [roleEnum], { user: ["password"] });
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;
    const recordSchema =
      doc.paths["/api/users/{id}"].get.responses["200"].content["application/json"].schema
        .properties.data;

    expect(recordSchema.properties).toHaveProperty("name");
    expect(recordSchema.properties).not.toHaveProperty("password");
  });

  it("excludes the PK and @default(now()) timestamp from the create request body, and marks remaining fields required", () => {
    const adapter = new FakeAdapter([userModel], [roleEnum], { user: ["password"] });
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;
    const createBody =
      doc.paths["/api/users"].post.requestBody.content["application/json"].schema;

    expect(createBody.properties).not.toHaveProperty("id");
    expect(createBody.properties).not.toHaveProperty("createdAt");
    // password is still writable (omit only hides it from responses)
    expect(createBody.properties).toHaveProperty("password");
    expect(createBody.required).toContain("name");
  });

  it("marks every field optional on the update request body", () => {
    const adapter = new FakeAdapter([userModel], [roleEnum]);
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;
    const updateBody =
      doc.paths["/api/users/{id}"].patch.requestBody.content["application/json"].schema;

    expect(updateBody.required ?? []).toEqual([]);
  });

  it("documents an enum field as a string enum matching its real members", () => {
    const adapter = new FakeAdapter([userModel], [roleEnum]);
    const routeConfig = new RouteConfig({ models: { user: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;
    const createBody =
      doc.paths["/api/users"].post.requestBody.content["application/json"].schema;

    expect(createBody.properties.role).toEqual({
      type: "string",
      enum: ["ADMIN", "EDITOR", "VIEWER"],
    });
  });

  it("builds paths for multiple models under their own prefixes", () => {
    const adapter = new FakeAdapter([userModel, postModel], [roleEnum], {}, {
      user: "deletedAt",
    });
    const routeConfig = new RouteConfig({ models: { user: true, post: true } });

    const doc = OpenApiBuilder.build(adapter, routeConfig) as any;

    expect(doc.paths["/api/users"]).toBeDefined();
    expect(doc.paths["/api/posts"]).toBeDefined();
    expect(doc.paths["/api/posts"].get.tags).toEqual(["Post"]);
  });

  it("defaults info title/version and accepts overrides", () => {
    const adapter = new FakeAdapter([userModel]);
    const routeConfig = new RouteConfig({ models: { user: true } });

    const defaultDoc = OpenApiBuilder.build(adapter, routeConfig) as any;
    expect(defaultDoc.info.title).toBe("apiform API");

    const customDoc = OpenApiBuilder.build(adapter, routeConfig, {
      title: "My API",
      version: "2.0.0",
    }) as any;
    expect(customDoc.info.title).toBe("My API");
    expect(customDoc.info.version).toBe("2.0.0");
  });
});
