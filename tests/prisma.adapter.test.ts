import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PrismaAdapter } from "../src/adapters/prisma/prisma.adapter";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_SCHEMA_PATH = join(process.cwd(), "tests/fixtures/adapter-schema.prisma");

// Post has a numeric PK named "id" (the common case). User has a String PK
// (cuid-style) named "id". Widget has a PK that isn't named "id" at all —
// this is the case the router's `:id` URL-param convention has to be
// remapped for.
const TEST_SCHEMA = `
model User {
  id    String @id @default(cuid())
  name  String
}

model Post {
  id    Int    @id @default(autoincrement())
  title String
}

model Widget {
  widgetId String @id @default(cuid())
  label    String
}

model Account {
  id        Int       @id @default(autoincrement())
  name      String
  deletedAt DateTime?
}
`;

function makeDelegate() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    findUnique: async (args: Record<string, unknown>) => {
      calls.push({ method: "findUnique", args });
      return { ...(args.where as object) };
    },
    findFirst: async (args: Record<string, unknown>) => {
      calls.push({ method: "findFirst", args });
      return { ...(args.where as object) };
    },
    findMany: async (args: Record<string, unknown>) => {
      calls.push({ method: "findMany", args });
      return [];
    },
    count: async (args: Record<string, unknown>) => {
      calls.push({ method: "count", args });
      return 0;
    },
    create: async (args: Record<string, unknown>) => {
      calls.push({ method: "create", args });
      return { ...(args.data as object) };
    },
    update: async (args: Record<string, unknown>) => {
      calls.push({ method: "update", args });
      return { ...(args.where as object), ...(args.data as object) };
    },
    delete: async (args: Record<string, unknown>) => {
      calls.push({ method: "delete", args });
      return { ...(args.where as object) };
    },
  };
}

function makeClient() {
  return {
    $connect: async () => {},
    $disconnect: async () => {},
    user: makeDelegate(),
    post: makeDelegate(),
    widget: makeDelegate(),
    account: makeDelegate(),
  };
}

describe("PrismaAdapter — id resolution", () => {
  beforeAll(() => {
    mkdirSync(join(process.cwd(), "tests/fixtures"), { recursive: true });
    writeFileSync(TEST_SCHEMA_PATH, TEST_SCHEMA);
  });

  afterAll(() => {
    rmSync(join(process.cwd(), "tests/fixtures"), { recursive: true, force: true });
  });

  it("coerces a numeric PK's id to a number", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.findById("post", "5");
    expect(client.post.calls[0]?.args).toEqual({ where: { id: 5 } });
  });

  it("does not mangle a String PK that looks numeric", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    // Old behavior (!isNaN(Number(v))) would have coerced "00789" to 789,
    // silently corrupting a string identifier.
    await adapter.findById("user", "00789");
    expect(client.user.calls[0]?.args).toEqual({ where: { id: "00789" } });
  });

  it("remaps the router's `id` where-key to the model's real PK field name", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.findById("widget", "w1");
    expect(client.widget.calls[0]?.args).toEqual({ where: { widgetId: "w1" } });
  });

  it("applies the same remap + coercion on update", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.update("post", { where: { id: "5" }, data: { title: "x" } });
    expect(client.post.calls[0]?.args).toMatchObject({ where: { id: 5 } });

    await adapter.update("widget", { where: { id: "w1" }, data: { label: "x" } });
    expect(client.widget.calls[0]?.args).toMatchObject({ where: { widgetId: "w1" } });
  });

  it("applies the same remap + coercion on delete", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.delete("post", { where: { id: "5" } });
    expect(client.post.calls[0]?.args).toMatchObject({ where: { id: 5 } });
  });

  it("passes include through to findById", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.findById("post", "5", { comments: true });
    expect(client.post.calls[0]?.args).toMatchObject({
      where: { id: 5 },
      include: { comments: true },
    });
  });
});

describe("PrismaAdapter — findById excludes soft-deleted records", () => {
  beforeAll(() => {
    mkdirSync(join(process.cwd(), "tests/fixtures"), { recursive: true });
    writeFileSync(TEST_SCHEMA_PATH, TEST_SCHEMA);
  });

  afterAll(() => {
    rmSync(join(process.cwd(), "tests/fixtures"), { recursive: true, force: true });
  });

  it("uses findFirst with a deletedAt:null filter for a soft-delete-enabled model", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.findById("account", "1");

    expect(client.account.calls[0]?.method).toBe("findFirst");
    expect(client.account.calls[0]?.args).toMatchObject({
      where: { id: 1, deletedAt: null },
    });
  });

  it("still uses findUnique (no soft-delete filter) for a model without soft delete", async () => {
    const client = makeClient();
    const adapter = new PrismaAdapter(client, TEST_SCHEMA_PATH);
    await adapter.connect();

    await adapter.findById("post", "5");

    expect(client.post.calls[0]?.method).toBe("findUnique");
    expect(client.post.calls[0]?.args).toEqual({ where: { id: 5 } });
  });
});
