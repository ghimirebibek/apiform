import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { SchemaReader } from "../src/adapters/prisma/schema.reader";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_SCHEMA_PATH = join(process.cwd(), "tests/fixtures/schema.prisma");

const TEST_SCHEMA = `
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

describe("SchemaReader", () => {
  beforeAll(() => {
    mkdirSync(join(process.cwd(), "tests/fixtures"), { recursive: true });
    writeFileSync(TEST_SCHEMA_PATH, TEST_SCHEMA);
  });

  afterAll(() => {
    rmSync(join(process.cwd(), "tests/fixtures"), {
      recursive: true,
      force: true,
    });
  });

  it("should read and parse models from schema", () => {
    const reader = new SchemaReader(TEST_SCHEMA_PATH);
    const { models } = reader.read();

    expect(models.length).toBe(2);
    expect(models[0]?.name).toBe("User");
    expect(models[1]?.name).toBe("Post");
  });

  it("should parse fields correctly", () => {
    const reader = new SchemaReader(TEST_SCHEMA_PATH);
    const { models } = reader.read();
    const userModel = models[0];

    expect(userModel?.fields.length).toBeGreaterThan(0);

    const idField = userModel?.fields.find((f) => f.name === "id");
    expect(idField?.isId).toBe(true);
    expect(idField?.isRequired).toBe(true);

    const emailField = userModel?.fields.find((f) => f.name === "email");
    expect(emailField?.isUnique).toBe(true);

    const updatedAtField = userModel?.fields.find((f) => f.name === "updatedAt");
    expect(updatedAtField?.isUpdatedAt).toBe(true);

    const createdAtField = userModel?.fields.find((f) => f.name === "createdAt");
    expect(createdAtField?.default).toBe("now()");
  });

  it("should mark optional fields as not required", () => {
    const reader = new SchemaReader(TEST_SCHEMA_PATH);
    const { models } = reader.read();
    const postModel = models[1];

    const contentField = postModel?.fields.find((f) => f.name === "content");
    expect(contentField?.isRequired).toBe(false);
  });

  it("should throw if schema file does not exist", () => {
    const reader = new SchemaReader("nonexistent/schema.prisma");
    expect(() => reader.read()).toThrow();
  });
});

describe("SchemaReader — enums", () => {
  const ENUM_SCHEMA_PATH = join(process.cwd(), "tests/fixtures/enum-schema.prisma");
  const ENUM_SCHEMA = `
enum Role {
  ADMIN
  EDITOR
  VIEWER
}

model User {
  id   Int    @id @default(autoincrement())
  name String
  role Role   @default(VIEWER)
}
`;

  beforeAll(() => {
    mkdirSync(join(process.cwd(), "tests/fixtures"), { recursive: true });
    writeFileSync(ENUM_SCHEMA_PATH, ENUM_SCHEMA);
  });

  afterAll(() => {
    rmSync(join(process.cwd(), "tests/fixtures"), { recursive: true, force: true });
  });

  it("parses enum blocks into name + values", () => {
    const reader = new SchemaReader(ENUM_SCHEMA_PATH);
    const { enums } = reader.read();

    expect(enums).toEqual([{ name: "Role", values: ["ADMIN", "EDITOR", "VIEWER"] }]);
  });

  it("keeps the enum-typed field's raw type as the enum name", () => {
    const reader = new SchemaReader(ENUM_SCHEMA_PATH);
    const { models } = reader.read();

    const roleField = models[0]?.fields.find((f) => f.name === "role");
    expect(roleField?.type).toBe("Role");
  });
});

describe("SchemaReader — comment handling", () => {
  const COMMENT_SCHEMA_PATH = join(process.cwd(), "tests/fixtures/comment-schema.prisma");
  const COMMENT_SCHEMA = `
/**
 * A user of the system.
 * Has an @id and @default(now()) just to be tricky in this comment.
 */
model User {
  id   Int    @id @default(autoincrement())
  name String // the user's display name, not an @id
}
`;

  beforeAll(() => {
    mkdirSync(join(process.cwd(), "tests/fixtures"), { recursive: true });
    writeFileSync(COMMENT_SCHEMA_PATH, COMMENT_SCHEMA);
  });

  afterAll(() => {
    rmSync(join(process.cwd(), "tests/fixtures"), { recursive: true, force: true });
  });

  it("does not let a block comment's mention of @id/@default leak into field flags", () => {
    const reader = new SchemaReader(COMMENT_SCHEMA_PATH);
    const { models } = reader.read();

    expect(models.length).toBe(1);
    const idField = models[0]?.fields.find((f) => f.name === "id");
    expect(idField?.isId).toBe(true);
  });

  it("does not let a trailing line comment's mention of @id leak into field flags", () => {
    const reader = new SchemaReader(COMMENT_SCHEMA_PATH);
    const { models } = reader.read();

    const nameField = models[0]?.fields.find((f) => f.name === "name");
    expect(nameField?.isId).toBe(false);
    expect(nameField?.type).toBe("String");
  });
});
