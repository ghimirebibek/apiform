import { describe, it, expect } from "bun:test";
import { SoftDeleteManager } from "../src/core/soft-delete.manager";
import type { ModelDefinition } from "../src/types/adapter.types";

const mockModel: ModelDefinition = {
  name: "User",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    {
      name: "name",
      type: "String",
      isRequired: true,
      isId: false,
      isUnique: false,
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

const mockModelWithoutSoftDelete: ModelDefinition = {
  name: "Post",
  fields: [
    { name: "id", type: "Int", isRequired: true, isId: true, isUnique: false },
    {
      name: "title",
      type: "String",
      isRequired: true,
      isId: false,
      isUnique: false,
    },
  ],
};

describe("SoftDeleteManager", () => {
  it("should auto detect deletedAt field", () => {
    const field = SoftDeleteManager.getDeletedAtField(mockModel, undefined);
    expect(field).toBe("deletedAt");
  });

  it("should return null if no deletedAt field and not configured", () => {
    const field = SoftDeleteManager.getDeletedAtField(
      mockModelWithoutSoftDelete,
      undefined
    );
    expect(field).toBeNull();
  });

  it("should return deletedAt when softDelete is true", () => {
    const field = SoftDeleteManager.getDeletedAtField(
      mockModelWithoutSoftDelete,
      true
    );
    expect(field).toBe("deletedAt");
  });

  it("should return custom field name when softDelete is a string", () => {
    const field = SoftDeleteManager.getDeletedAtField(
      mockModelWithoutSoftDelete,
      "deleted_at"
    );
    expect(field).toBe("deleted_at");
  });

  it("should return null when softDelete is false", () => {
    const field = SoftDeleteManager.getDeletedAtField(mockModel, false);
    expect(field).toBeNull();
  });

  it("should exclude deleted records from where clause", () => {
    const where = SoftDeleteManager.excludeDeleted(
      { name: "John" },
      "deletedAt"
    );
    expect(where).toEqual({ name: "John", deletedAt: null });
  });

  it("should only include deleted records in where clause", () => {
    const where = SoftDeleteManager.onlyDeleted({}, "deletedAt");
    expect(where).toEqual({ deletedAt: { not: null } });
  });

  it("should build soft delete data payload", () => {
    const data = SoftDeleteManager.softDeleteData("deletedAt");
    expect(data["deletedAt"]).toBeInstanceOf(Date);
  });

  it("should build restore data payload", () => {
    const data = SoftDeleteManager.restoreData("deletedAt");
    expect(data).toEqual({ deletedAt: null });
  });
});
