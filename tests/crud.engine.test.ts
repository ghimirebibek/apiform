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

  async findAll(): Promise<CrudResult<unknown[]>> {
    return { data: [] };
  }

  async findOne(_model: string, _options: FindOneOptions): Promise<CrudResult<unknown>> {
    return { data: null };
  }

  async findById(): Promise<CrudResult<unknown>> {
    return { data: null };
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
