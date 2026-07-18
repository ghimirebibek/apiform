import { describe, it, expect } from "bun:test";
import { FilterBuilder } from "../src/core/filter.builder";
import type { ModelDefinition } from "../src/types/adapter.types";

const userModel: ModelDefinition = {
  name: "User",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    { name: "name", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "age", type: "Int", isRequired: true, isId: false, isUnique: false },
    { name: "password", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "manager", type: "User", isRequired: false, isId: false, isUnique: false },
    { name: "posts", type: "Post[]", isRequired: false, isId: false, isUnique: false },
    { name: "tags", type: "String[]", isRequired: false, isId: false, isUnique: false },
  ],
};

const allModelNames = new Set(["user", "post"]);

describe("FilterBuilder.build", () => {
  it("keeps a primitive exact-match filter on a real scalar field", () => {
    const result = FilterBuilder.build({ name: "Alice" }, userModel, allModelNames);
    expect(result).toEqual({ name: "Alice" });
  });

  it("drops fields that don't exist on the model", () => {
    const result = FilterBuilder.build(
      { nonexistent: "x" },
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("drops relation fields to prevent cross-model probing", () => {
    const result = FilterBuilder.build(
      { manager: { id: 1 }, posts: { id: 1 } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("drops list-scalar fields", () => {
    const result = FilterBuilder.build(
      { tags: { has: "x" } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("keeps whitelisted operators with primitive values", () => {
    const result = FilterBuilder.build(
      { age: { gte: 18, lte: 65 } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({ age: { gte: 18, lte: 65 } });
  });

  it("drops disallowed operators (e.g. Prisma logical/relation operators)", () => {
    const result = FilterBuilder.build(
      { age: { gte: 18, AND: [{ name: "x" }] } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({ age: { gte: 18 } });
  });

  it("drops a field whose value is only disallowed operators", () => {
    const result = FilterBuilder.build(
      { age: { AND: [{ name: "x" }] } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("sanitizes in/notIn arrays down to primitives", () => {
    const result = FilterBuilder.build(
      { id: { in: [1, 2, "3", { evil: true }] } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({ id: { in: [1, 2, "3"] } });
  });

  it("rejects a top-level array value (not a valid filter shape)", () => {
    const result = FilterBuilder.build(
      { name: ["a", "b"] },
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("blocks an OR/AND injection attempt disguised as a nested where clause", () => {
    // Simulates an attacker passing ?filters={"OR":[{"password":{"not":null}}]}
    const result = FilterBuilder.build(
      { OR: [{ password: { not: null } }] } as Record<string, unknown>,
      userModel,
      allModelNames
    );
    expect(result).toEqual({});
  });

  it("ignores unknown operators inside an object value", () => {
    const result = FilterBuilder.build(
      { age: { gte: 18, someMadeUpOp: "x" } },
      userModel,
      allModelNames
    );
    expect(result).toEqual({ age: { gte: 18 } });
  });

  it("drops a field that is configured as omit, even though it's a real scalar field", () => {
    // A field hidden from every response (e.g. password) must not be
    // filterable either — otherwise its value/existence can be probed
    // indirectly via which filter values return a match.
    const result = FilterBuilder.build(
      { password: { not: null }, name: "Alice" },
      userModel,
      allModelNames,
      ["password"]
    );
    expect(result).toEqual({ name: "Alice" });
  });
});

describe("FilterBuilder.isFilterableField", () => {
  it("allows a real scalar field", () => {
    expect(
      FilterBuilder.isFilterableField("name", userModel, allModelNames)
    ).toBe(true);
  });

  it("rejects a relation field", () => {
    expect(
      FilterBuilder.isFilterableField("manager", userModel, allModelNames)
    ).toBe(false);
  });

  it("rejects a list-scalar field", () => {
    expect(
      FilterBuilder.isFilterableField("tags", userModel, allModelNames)
    ).toBe(false);
  });

  it("rejects a field that doesn't exist on the model", () => {
    expect(
      FilterBuilder.isFilterableField("nonexistent", userModel, allModelNames)
    ).toBe(false);
  });

  it("rejects a field configured as omit even though it's a filterable scalar", () => {
    expect(
      FilterBuilder.isFilterableField("password", userModel, allModelNames, [
        "password",
      ])
    ).toBe(false);
  });
});
