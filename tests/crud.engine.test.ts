import { describe, it, expect } from "bun:test";
import { CrudEngine } from "../src/core/crud.engine";
import { BaseAdapter } from "../src/adapters/base.adapter";
import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "../src/types/crud.types";
import type { ModelDefinition } from "../src/types/adapter.types";

// User has a *custom-named* soft-delete field ("deleted_at" instead of the
// conventional "deletedAt") and a custom-named auto-updated-at field, to
// prove writable-field exclusion is no longer hardcoded to literal names.
const userModel: ModelDefinition = {
  name: "User",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    { name: "name", type: "String", isRequired: true, isId: false, isUnique: false },
    {
      name: "createdAt",
      type: "DateTime",
      isRequired: true,
      isId: false,
      isUnique: false,
      default: "now()",
    },
    {
      name: "modified_at",
      type: "DateTime",
      isRequired: true,
      isId: false,
      isUnique: false,
      isUpdatedAt: true,
    },
    {
      name: "deleted_at",
      type: "DateTime",
      isRequired: false,
      isId: false,
      isUnique: false,
    },
  ],
};

class FakeAdapter extends BaseAdapter {
  constructor(models: ModelDefinition[], private softDeleteField: string | null = null) {
    super();
    this.models = models;
  }

  override getSoftDeleteField(_model: string): string | null {
    return this.softDeleteField;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async findAll(_model: string, _options: FindAllOptions): Promise<CrudResult<unknown[]>> {
    return { data: [{ id: 1, name: "Alice" }] };
  }

  async findOne(_model: string, _options: FindOneOptions): Promise<CrudResult<unknown>> {
    return { data: null };
  }

  async findById(_model: string, id: string | number): Promise<CrudResult<unknown>> {
    if (id === "missing") return { data: null };
    return { data: { id, name: "Alice" } };
  }

  async create(_model: string, options: CreateOptions): Promise<CrudResult<unknown>> {
    return { data: options.data };
  }

  async update(_model: string, options: UpdateOptions): Promise<CrudResult<unknown>> {
    return { data: options.data };
  }

  async delete(_model: string, _options: DeleteOptions): Promise<CrudResult<unknown>> {
    return { data: null };
  }
}

describe("CrudEngine writable-field exclusion", () => {
  it("does not require the auto-managed createdAt/updatedAt-style fields on create", async () => {
    const adapter = new FakeAdapter([userModel], "deleted_at");
    const engine = new CrudEngine(adapter);

    const result = await engine.create("user", { data: { name: "Alice" } });
    expect(result.success).toBe(true);
  });

  it("strips createdAt/modified_at/deleted_at even if the client sends them", async () => {
    const adapter = new FakeAdapter([userModel], "deleted_at");
    const engine = new CrudEngine(adapter);

    const result = await engine.create("user", {
      data: {
        name: "Alice",
        createdAt: "2020-01-01",
        modified_at: "2020-01-01",
        deleted_at: "2020-01-01",
      },
    });

    expect(result.success).toBe(true);
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("createdAt");
    expect(data).not.toHaveProperty("modified_at");
    expect(data).not.toHaveProperty("deleted_at");
    expect(data.name).toBe("Alice");
  });

  it("respects a renamed soft-delete field instead of only the literal 'deletedAt'", async () => {
    // Previously this would have wrongly treated deleted_at as a normal,
    // required, client-writable field because the exclusion list only
    // checked for the literal string "deletedAt".
    const adapter = new FakeAdapter([userModel], "deleted_at");
    const engine = new CrudEngine(adapter);

    const result = await engine.update("user", {
      where: { id: 1 },
      data: { name: "Bob" },
    });

    expect(result.success).toBe(true);
  });

  it("falls back to no soft-delete exclusion when the model doesn't support it", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);

    const result = await engine.create("user", { data: { name: "Alice" } });
    expect(result.success).toBe(true);
  });
});

const fakeRequest = { headers: {}, tenantId: "tenant-1" } as any;

describe("CrudEngine lifecycle hooks", () => {
  it("runs beforeCreate after whitelist stripping, so it can add server-derived fields", async () => {
    const adapter = new FakeAdapter([userModel], "deleted_at");
    const engine = new CrudEngine(adapter);

    const result = await engine.create(
      "user",
      { data: { name: "Alice" } },
      {
        hooks: {
          beforeCreate: (data) => ({ ...data, tenantId: "tenant-1" }),
        },
        request: fakeRequest,
      }
    );

    expect(result.success).toBe(true);
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.tenantId).toBe("tenant-1");
    expect(data.name).toBe("Alice");
  });

  it("passes model and request through the hook context", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);
    let seenModel: string | undefined;
    let seenRequest: unknown;

    await engine.create(
      "user",
      { data: { name: "Alice" } },
      {
        hooks: {
          beforeCreate: (data, ctx) => {
            seenModel = ctx.model;
            seenRequest = ctx.request;
            return data;
          },
        },
        request: fakeRequest,
      }
    );

    expect(seenModel).toBe("user");
    expect(seenRequest).toBe(fakeRequest);
  });

  it("lets afterCreate reshape the response record", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);

    const result = await engine.create(
      "user",
      { data: { name: "Alice" } },
      {
        hooks: {
          afterCreate: (record) => ({ ...(record as object), computed: true }),
        },
        request: fakeRequest,
      }
    );

    expect((result as { data: Record<string, unknown> }).data.computed).toBe(true);
  });

  it("lets beforeUpdate enrich data and afterUpdate reshape the response", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);

    const result = await engine.update(
      "user",
      { where: { id: 1 }, data: { name: "Bob" } },
      {
        hooks: {
          beforeUpdate: (data) => ({ ...data, editedBy: "admin" }),
          afterUpdate: (record) => ({ ...(record as object), audited: true }),
        },
        request: fakeRequest,
      }
    );

    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.editedBy).toBe("admin");
    expect(data.audited).toBe(true);
  });

  it("lets beforeDelete block the delete by throwing", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);

    const result = await engine.delete(
      "user",
      { where: { id: 1 } },
      {
        hooks: {
          beforeDelete: () => {
            throw new Error("cannot delete: has dependent records");
          },
        },
        request: fakeRequest,
      }
    );

    expect(result.success).toBe(false);
  });

  it("lets afterDelete reshape the response record", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);

    const result = await engine.delete(
      "user",
      { where: { id: 1 } },
      {
        hooks: { afterDelete: () => ({ archived: true }) },
        request: fakeRequest,
      }
    );

    expect((result as { data: Record<string, unknown> }).data).toEqual({ archived: true });
  });

  it("lets beforeFindAll mutate the query (e.g. tenant scoping) and afterFindAll mutate results", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);
    let seenOptions: FindAllOptions | undefined;

    const originalFindAll = adapter.findAll.bind(adapter);
    adapter.findAll = async (model, options) => {
      seenOptions = options;
      return originalFindAll(model, options);
    };

    const result = await engine.findAll(
      "user",
      {},
      {
        hooks: {
          beforeFindAll: (options, ctx) => ({
            ...options,
            where: { tenantId: (ctx.request as any).tenantId },
          }),
          afterFindAll: (records) => records.map((r) => ({ ...(r as object), scoped: true })),
        },
        request: fakeRequest,
      }
    );

    expect(seenOptions?.where).toEqual({ tenantId: "tenant-1" });
    const data = (result as { data: Record<string, unknown>[] }).data;
    expect(data[0]?.scoped).toBe(true);
  });

  it("lets beforeFindById run a check and afterFindById reshape the record", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);
    let seenId: string | number | undefined;

    const result = await engine.findById(
      "user",
      "1",
      undefined,
      undefined,
      {
        hooks: {
          beforeFindById: (id) => {
            seenId = id;
          },
          afterFindById: (record) => ({ ...(record as object), viewed: true }),
        },
        request: fakeRequest,
      }
    );

    expect(seenId).toBe("1");
    expect((result as { data: Record<string, unknown> }).data.viewed).toBe(true);
  });

  it("does not run afterFindById when the record is not found", async () => {
    const adapter = new FakeAdapter([userModel], null);
    const engine = new CrudEngine(adapter);
    let afterCalled = false;

    const result = await engine.findById(
      "user",
      "missing",
      undefined,
      undefined,
      {
        hooks: {
          afterFindById: (record) => {
            afterCalled = true;
            return record;
          },
        },
        request: fakeRequest,
      }
    );

    expect(result.success).toBe(false);
    expect(afterCalled).toBe(false);
  });
});
