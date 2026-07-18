// PrismaClient is provided by the consuming project after running `prisma generate`
type PrismaClient = any;

import { BaseAdapter } from "../base.adapter";
import { SchemaReader } from "./schema.reader";
import { SoftDeleteManager } from "../../core/soft-delete.manager";
import { FieldMasker } from "../../core/field.masker";
import { FilterBuilder } from "../../core/filter.builder";
import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "../../types/crud.types";
import type { ModelRouteConfig } from "../../types/config.types";
import type { ModelField } from "../../types/adapter.types";

const NUMERIC_FIELD_TYPES = new Set(["int", "integer", "float", "decimal", "bigint"]);

export class PrismaAdapter extends BaseAdapter {
  private client: PrismaClient;
  private schemaReader: SchemaReader;
  private modelConfigs: Record<string, ModelRouteConfig> = {};

  constructor(client: PrismaClient, schemaPath?: string) {
    super();
    this.client = client;
    this.schemaReader = new SchemaReader(schemaPath);
  }

  setModelConfigs(configs: Record<string, ModelRouteConfig>): void {
    this.modelConfigs = Object.fromEntries(
      Object.entries(configs).map(([k, v]) => [k.toLowerCase(), v])
    );
  }

  async connect(): Promise<void> {
    await this.client.$connect();
    const schema = this.schemaReader.read();
    this.models = schema.models;
    this.enums = schema.enums;
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  private getDelegate(model: string): any {
    const delegate = (this.client as any)[model.toLowerCase()];
    if (!delegate) {
      throw new Error(`Model "${model}" not found on Prisma client`);
    }
    return delegate;
  }

  private getDeletedAtField(model: string): string | null {
    const modelDef = this.getModel(model);
    if (!modelDef) return null;
    const config = this.modelConfigs[model.toLowerCase()];
    const result = SoftDeleteManager.getDeletedAtField(
      modelDef,
      config?.softDelete
    );
    return result;
  }

  override getOmitFields(model: string): string[] {
    return this.modelConfigs[model.toLowerCase()]?.omit ?? [];
  }

  override getSoftDeleteField(model: string): string | null {
    return this.getDeletedAtField(model);
  }

  private mask<T>(model: string, data: T): T {
    return FieldMasker.mask(
      data,
      model,
      (name) => this.getModel(name),
      (name) => this.getOmitFields(name)
    ) as T;
  }

  private getIdField(model: string): ModelField | undefined {
    return this.getModel(model)?.fields.find((f) => f.isId);
  }

  // Coerce a URL/path param value to the field's declared scalar type.
  // Previously this guessed numeric-vs-string via isNaN(Number(v)), which
  // wrongly coerced String-typed IDs (e.g. cuid/uuid) that happen to look
  // numeric. Now it only coerces when the field is actually a numeric type.
  private coerceIdValue(value: unknown, field?: ModelField): unknown {
    if (typeof value !== "string" || !field) return value;
    if (!NUMERIC_FIELD_TYPES.has(field.type.toLowerCase())) return value;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  }

  // Build a Prisma `where` clause for a single-record lookup by id. The
  // router always names the URL param "id" regardless of what the model's
  // actual primary key field is called, so remap it here.
  private buildIdWhere(model: string, id: string | number): Record<string, unknown> {
    const idField = this.getIdField(model);
    const fieldName = idField?.name ?? "id";
    return { [fieldName]: this.coerceIdValue(id, idField) };
  }

  private resolveWhere(
    model: string,
    where: Record<string, unknown>
  ): Record<string, unknown> {
    const modelDef = this.getModel(model);
    const idField = this.getIdField(model);

    return Object.fromEntries(
      Object.entries(where).map(([key, value]) => {
        const targetKey = key === "id" && idField ? idField.name : key;
        const field = modelDef?.fields.find((f) => f.name === targetKey);
        return [targetKey, this.coerceIdValue(value, field)];
      })
    );
  }

  async findAll(
    model: string,
    options: FindAllOptions
  ): Promise<CrudResult<unknown[]>> {
    const {
      page = 1,
      limit = 10,
      where = {},
      sortBy = "createdAt",
      sortOrder = "desc",
      searchBy,
      searchValue,
      filters = {},
      include,
    } = options;

    const offset = (page - 1) * limit;

    const modelDef = this.getModel(model);
    const allModelNames = new Set(this.models.map((m) => m.name.toLowerCase()));
    const omitFields = this.getOmitFields(model);
    const safeFilters = modelDef
      ? FilterBuilder.build(filters, modelDef, allModelNames, omitFields)
      : {};

    let whereClause: Record<string, unknown> = { ...where, ...safeFilters };

    const searchAllowed =
      searchBy &&
      modelDef &&
      FilterBuilder.isFilterableField(searchBy, modelDef, allModelNames, omitFields);
    if (searchAllowed && searchValue) {
      whereClause[searchBy] = { contains: searchValue, mode: "insensitive" };
    }

    const deletedAtField = this.getDeletedAtField(model);
    if (deletedAtField) {
      whereClause = SoftDeleteManager.excludeDeleted(
        whereClause,
        deletedAtField
      );
    }

    const delegate = this.getDelegate(model);
    const [data, total] = await Promise.all([
      delegate.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
        ...(include ? { include } : {}),
      }),
      delegate.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: this.mask(model, data),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(
    model: string,
    options: FindOneOptions
  ): Promise<CrudResult<unknown>> {
    let whereClause = { ...options.where };

    const deletedAtField = this.getDeletedAtField(model);
    if (deletedAtField) {
      whereClause = SoftDeleteManager.excludeDeleted(
        whereClause,
        deletedAtField
      ) as typeof whereClause;
    }

    const delegate = this.getDelegate(model);
    const data = await delegate.findFirst({
      where: whereClause,
      ...(options.include ? { include: options.include } : {}),
    });
    return { data: this.mask(model, data) };
  }

  async findById(
    model: string,
    id: string | number,
    include?: Record<string, boolean>
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    let where = this.buildIdWhere(model, id);

    const deletedAtField = this.getDeletedAtField(model);
    if (deletedAtField) {
      where = SoftDeleteManager.excludeDeleted(where, deletedAtField);
    }

    // findUnique can't take a compound/non-unique where (e.g. the added
    // deletedAt filter breaks findUnique's single-unique-field contract
    // once more than the id is present), so once soft-delete exclusion is
    // in play this has to use findFirst instead.
    const data = deletedAtField
      ? await delegate.findFirst({ where, ...(include ? { include } : {}) })
      : await delegate.findUnique({ where, ...(include ? { include } : {}) });

    return { data: this.mask(model, data) };
  }

  async create(
    model: string,
    options: CreateOptions
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const data = await delegate.create({ data: options.data });
    return { data: this.mask(model, data) };
  }

  async update(
    model: string,
    options: UpdateOptions
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const where = this.resolveWhere(model, options.where);
    const data = await delegate.update({ where, data: options.data });
    return { data: this.mask(model, data) };
  }

  async delete(
    model: string,
    options: DeleteOptions
  ): Promise<CrudResult<unknown>> {
    const deletedAtField = this.getDeletedAtField(model);
    const delegate = this.getDelegate(model);
    const where = this.resolveWhere(model, options.where);

    if (deletedAtField) {
      const data = await delegate.update({
        where,
        data: SoftDeleteManager.softDeleteData(deletedAtField),
      });
      return { data: this.mask(model, data) };
    }

    const data = await delegate.delete({ where });
    return { data: this.mask(model, data) };
  }

  async restore(
    model: string,
    id: string | number
  ): Promise<CrudResult<unknown>> {
    const deletedAtField = this.getDeletedAtField(model);
    if (!deletedAtField) {
      throw new Error(`Model "${model}" does not support soft delete`);
    }

    const delegate = this.getDelegate(model);
    const data = await delegate.update({
      where: this.buildIdWhere(model, id),
      data: SoftDeleteManager.restoreData(deletedAtField),
    });
    return { data: this.mask(model, data) };
  }

  async findDeleted(
    model: string,
    options: FindAllOptions
  ): Promise<CrudResult<unknown[]>> {
    const deletedAtField = this.getDeletedAtField(model);
    if (!deletedAtField) {
      throw new Error(`Model "${model}" does not support soft delete`);
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "deletedAt",
      sortOrder = "desc",
    } = options;
    const offset = (page - 1) * limit;
    const whereClause = SoftDeleteManager.onlyDeleted({}, deletedAtField);
    const delegate = this.getDelegate(model);

    const [data, total] = await Promise.all([
      delegate.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      delegate.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: this.mask(model, data),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
