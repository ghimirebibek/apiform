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
    const models = reader.read();

    expect(models.length).toBe(2);
    expect(models[0]?.name).toBe("User");
    expect(models[1]?.name).toBe("Post");
  });

  it("should parse fields correctly", () => {
    const reader = new SchemaReader(TEST_SCHEMA_PATH);
    const models = reader.read();
    const userModel = models[0];

    expect(userModel?.fields.length).toBeGreaterThan(0);

    const idField = userModel?.fields.find((f) => f.name === "id");
    expect(idField?.isId).toBe(true);
    expect(idField?.isRequired).toBe(true);

    const emailField = userModel?.fields.find((f) => f.name === "email");
    expect(emailField?.isUnique).toBe(true);
  });

  it("should mark optional fields as not required", () => {
    const reader = new SchemaReader(TEST_SCHEMA_PATH);
    const models = reader.read();
    const postModel = models[1];

    const contentField = postModel?.fields.find((f) => f.name === "content");
    expect(contentField?.isRequired).toBe(false);
  });

  it("should throw if schema file does not exist", () => {
    const reader = new SchemaReader("nonexistent/schema.prisma");
    expect(() => reader.read()).toThrow();
  });
});
