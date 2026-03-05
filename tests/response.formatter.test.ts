import { describe, it, expect } from "bun:test";
import { ResponseFormatter } from "../src/core/response.formatter";
import { ErrorCode } from "../src/types/response.types";

describe("ResponseFormatter", () => {
  it("should return a success response", () => {
    const response = ResponseFormatter.success(
      { id: 1 },
      "USER_RETRIEVED_SUCCESSFULLY"
    );

    expect(response.success).toBe(true);
    expect(response.message).toBe("USER_RETRIEVED_SUCCESSFULLY");
    expect(response.data).toEqual({ id: 1 });
    expect(response.meta).toBeNull();
    expect(response.error).toBeNull();
  });

  it("should return an error response", () => {
    const response = ResponseFormatter.error("NOT_FOUND", ErrorCode.NOT_FOUND);

    expect(response.success).toBe(false);
    expect(response.message).toBe("NOT_FOUND");
    expect(response.data).toBeNull();
    expect(response.meta).toBeNull();
    expect(response.error?.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("should return a paginated response", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const response = ResponseFormatter.paginate(data, "user", 1, 10, 20);

    expect(response.success).toBe(true);
    expect(response.message).toBe("USERS_RETRIEVED_SUCCESSFULLY");
    expect(response.data).toEqual(data);
    expect(response.meta?.total).toBe(20);
    expect(response.meta?.page).toBe(1);
    expect(response.meta?.limit).toBe(10);
    expect(response.meta?.totalPages).toBe(2);
    expect(response.meta?.hasNext).toBe(true);
    expect(response.meta?.hasPrev).toBe(false);
  });

  it("should format messages correctly", () => {
    expect(ResponseFormatter.formatMessage("create", "user")).toBe(
      "USER_CREATED_SUCCESSFULLY"
    );
    expect(ResponseFormatter.formatMessage("findAll", "user")).toBe(
      "USERS_RETRIEVED_SUCCESSFULLY"
    );
    expect(ResponseFormatter.formatMessage("findById", "user")).toBe(
      "USER_RETRIEVED_SUCCESSFULLY"
    );
    expect(ResponseFormatter.formatMessage("update", "user")).toBe(
      "USER_UPDATED_SUCCESSFULLY"
    );
    expect(ResponseFormatter.formatMessage("delete", "user")).toBe(
      "USER_DELETED_SUCCESSFULLY"
    );
  });

  it("should correctly calculate hasNext and hasPrev", () => {
    const firstPage = ResponseFormatter.paginate([], "user", 1, 10, 30);
    expect(firstPage.meta?.hasNext).toBe(true);
    expect(firstPage.meta?.hasPrev).toBe(false);

    const lastPage = ResponseFormatter.paginate([], "user", 3, 10, 30);
    expect(lastPage.meta?.hasNext).toBe(false);
    expect(lastPage.meta?.hasPrev).toBe(true);

    const middlePage = ResponseFormatter.paginate([], "user", 2, 10, 30);
    expect(middlePage.meta?.hasNext).toBe(true);
    expect(middlePage.meta?.hasPrev).toBe(true);
  });
});
