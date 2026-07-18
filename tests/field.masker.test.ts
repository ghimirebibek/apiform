import { describe, it, expect } from "bun:test";
import { FieldMasker } from "../src/core/field.masker";
import type { ModelDefinition } from "../src/types/adapter.types";

const userModel: ModelDefinition = {
  name: "User",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    { name: "name", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "password", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "manager", type: "User", isRequired: false, isId: false, isUnique: false },
    { name: "posts", type: "Post[]", isRequired: false, isId: false, isUnique: false },
  ],
};

const postModel: ModelDefinition = {
  name: "Post",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    { name: "title", type: "String", isRequired: true, isId: false, isUnique: false },
    { name: "author", type: "User", isRequired: false, isId: false, isUnique: false },
  ],
};

const models: Record<string, ModelDefinition> = {
  user: userModel,
  post: postModel,
};

const getModel = (name: string) => models[name.toLowerCase()];

function makeOmitLookup(omitConfig: Record<string, string[]>) {
  return (name: string) => omitConfig[name.toLowerCase()] ?? [];
}

describe("FieldMasker.mask", () => {
  it("strips omitted fields from a flat object", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    const result = FieldMasker.mask(
      { id: 1, name: "Alice", password: "secret" },
      "User",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("strips omitted fields from every item in an array", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    const result = FieldMasker.mask(
      [
        { id: 1, name: "Alice", password: "secret" },
        { id: 2, name: "Bob", password: "secret2" },
      ],
      "User",
      getModel,
      getOmitFields
    );
    expect(result).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
  });

  it("does nothing when the model has no omit config", () => {
    const getOmitFields = makeOmitLookup({});
    const result = FieldMasker.mask(
      { id: 1, name: "Alice", password: "secret" },
      "User",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({ id: 1, name: "Alice", password: "secret" });
  });

  it("recurses into an included relation using the related model's own omit config", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    const result = FieldMasker.mask(
      {
        id: 1,
        title: "Hello",
        author: { id: 10, name: "Alice", password: "secret" },
      },
      "Post",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({
      id: 1,
      title: "Hello",
      author: { id: 10, name: "Alice" },
    });
  });

  it("recurses into a one-to-many included relation array", () => {
    const getOmitFields = makeOmitLookup({ user: [], post: ["title"] });
    const result = FieldMasker.mask(
      {
        id: 10,
        name: "Alice",
        posts: [{ id: 1, title: "Hello", author: null }],
      },
      "User",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({
      id: 10,
      name: "Alice",
      posts: [{ id: 1, author: null }],
    });
  });

  it("masks self-relations instead of passing them through unmasked", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    const result = FieldMasker.mask(
      {
        id: 1,
        name: "Alice",
        password: "secret",
        manager: { id: 2, name: "Bob", password: "secret2", manager: null },
      },
      "User",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({
      id: 1,
      name: "Alice",
      manager: { id: 2, name: "Bob", manager: null },
    });
  });

  it("returns null/undefined/primitives unchanged", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    expect(FieldMasker.mask(null, "User", getModel, getOmitFields)).toBeNull();
    expect(
      FieldMasker.mask(undefined, "User", getModel, getOmitFields)
    ).toBeUndefined();
  });

  it("returns data unchanged when the model is unknown", () => {
    const getOmitFields = makeOmitLookup({});
    const result = FieldMasker.mask(
      { id: 1, secret: "x" },
      "Unknown",
      getModel,
      getOmitFields
    );
    expect(result).toEqual({ id: 1, secret: "x" });
  });
});

describe("FieldMasker.select", () => {
  it("returns data unchanged when no fields are given", () => {
    const data = { id: 1, name: "Alice" };
    expect(FieldMasker.select(data, undefined)).toEqual(data);
    expect(FieldMasker.select(data, [])).toEqual(data);
  });

  it("projects a flat object down to the requested fields", () => {
    const result = FieldMasker.select(
      { id: 1, name: "Alice", email: "a@x.com" },
      ["id", "name"]
    );
    expect(result).toEqual({ id: 1, name: "Alice" });
  });

  it("projects every item in an array", () => {
    const result = FieldMasker.select(
      [
        { id: 1, name: "Alice", email: "a@x.com" },
        { id: 2, name: "Bob", email: "b@x.com" },
      ],
      ["id"]
    );
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("cannot re-select a field already stripped by mask()", () => {
    const getOmitFields = makeOmitLookup({ user: ["password"] });
    const masked = FieldMasker.mask(
      { id: 1, name: "Alice", password: "secret" },
      "User",
      getModel,
      getOmitFields
    );
    const result = FieldMasker.select(masked, ["id", "password"]);
    expect(result).toEqual({ id: 1 });
  });
});
