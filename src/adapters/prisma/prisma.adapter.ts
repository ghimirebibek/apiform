// PrismaClient is provided by the consuming project after running `prisma generate`
type PrismaClient = any;

import { BaseAdapter } from "../base.adapter";
import { SchemaReader } from "./schema.reader";
import { SoftDeleteManager } from "../../core/soft-delete.manager";
import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "../../types/crud.types";
import type { ModelRouteConfig } from "../../types/config.types";

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
    this.models = this.schemaReader.read();
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
    } = options;

    const offset = (page - 1) * limit;
    let whereClause: Record<string, unknown> = { ...where, ...filters };

    if (searchBy && searchValue) {
      whereClause[searchBy] = { contains: searchValue, mode: "insensitive" };
    }

    // Exclude soft deleted records
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
      }),
      delegate.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
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
    const data = await delegate.findFirst({ where: whereClause });
    return { data };
  }

  async findById(
    model: string,
    id: string | number
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const parsedId =
      typeof id === "string" && !isNaN(Number(id)) ? Number(id) : id;
    const data = await delegate.findUnique({ where: { id: parsedId } });
    return { data };
  }

  async create(
    model: string,
    options: CreateOptions
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const data = await delegate.create({ data: options.data });
    return { data };
  }

  async update(
    model: string,
    options: UpdateOptions
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const where = Object.fromEntries(
      Object.entries(options.where).map(([k, v]) => [
        k,
        typeof v === "string" && !isNaN(Number(v)) ? Number(v) : v,
      ])
    );
    const data = await delegate.update({ where, data: options.data });
    return { data };
  }

  async delete(
    model: string,
    options: DeleteOptions
  ): Promise<CrudResult<unknown>> {
    const deletedAtField = this.getDeletedAtField(model);
    const delegate = this.getDelegate(model);

    // Parse id to number if needed
    const where = Object.fromEntries(
      Object.entries(options.where).map(([k, v]) => [
        k,
        typeof v === "string" && !isNaN(Number(v)) ? Number(v) : v,
      ])
    );

    if (deletedAtField) {
      const data = await delegate.update({
        where,
        data: SoftDeleteManager.softDeleteData(deletedAtField),
      });
      return { data };
    }

    const data = await delegate.delete({ where });
    return { data };
  }

  async restore(
    model: string,
    id: string | number
  ): Promise<CrudResult<unknown>> {
    const deletedAtField = this.getDeletedAtField(model);
    if (!deletedAtField) {
      throw new Error(`Model "${model}" does not support soft delete`);
    }

    const parsedId =
      typeof id === "string" && !isNaN(Number(id)) ? Number(id) : id;
    const delegate = this.getDelegate(model);
    const data = await delegate.update({
      where: { id: parsedId },
      data: SoftDeleteManager.restoreData(deletedAtField),
    });
    return { data };
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
      data,
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
