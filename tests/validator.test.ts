import { describe, it, expect } from "bun:test";
import { Validator } from "../src/core/validator";
import type { EnumDefinition } from "../src/types/adapter.types";

const roleEnum: EnumDefinition = { name: "Role", values: ["ADMIN", "EDITOR", "VIEWER"] };
const getEnum = (name: string) =>
  name.toLowerCase() === "role" ? roleEnum : undefined;

describe("Validator — primitive type mapping", () => {
  it("accepts valid values for known scalar types", () => {
    const schema = Validator.buildSchema([
      { name: "name", type: "String", isRequired: true },
      { name: "age", type: "Int", isRequired: true },
      { name: "active", type: "Boolean", isRequired: true },
    ]);

    const result = Validator.validate(schema, { name: "Alice", age: 30, active: true });
    expect(result.success).toBe(true);
  });

  it("rejects the wrong type for a known scalar field", () => {
    const schema = Validator.buildSchema([
      { name: "age", type: "Int", isRequired: true },
    ]);

    const result = Validator.validate(schema, { age: "not a number" });
    expect(result.success).toBe(false);
  });

  it("makes non-required fields optional", () => {
    const schema = Validator.buildSchema([
      { name: "nickname", type: "String", isRequired: false },
    ]);

    const result = Validator.validate(schema, {});
    expect(result.success).toBe(true);
  });
});

describe("Validator — enum type mapping", () => {
  it("accepts a value that is a member of the enum", () => {
    const schema = Validator.buildSchema(
      [{ name: "role", type: "Role", isRequired: true }],
      getEnum
    );

    const result = Validator.validate(schema, { role: "ADMIN" });
    expect(result.success).toBe(true);
  });

  it("rejects a value that is not a member of the enum", () => {
    const schema = Validator.buildSchema(
      [{ name: "role", type: "Role", isRequired: true }],
      getEnum
    );

    const result = Validator.validate(schema, { role: "SUPERADMIN" });
    expect(result.success).toBe(false);
  });

  it("falls back to unknown (accepts anything) when no enum lookup is given", () => {
    const schema = Validator.buildSchema([
      { name: "role", type: "Role", isRequired: true },
    ]);

    const result = Validator.validate(schema, { role: "literally anything" });
    expect(result.success).toBe(true);
  });

  it("falls back to unknown when the type doesn't match a known enum", () => {
    const schema = Validator.buildSchema(
      [{ name: "status", type: "Status", isRequired: true }],
      getEnum
    );

    const result = Validator.validate(schema, { status: "whatever" });
    expect(result.success).toBe(true);
  });
});
