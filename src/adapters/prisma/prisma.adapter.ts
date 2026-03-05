type PrismaClient = any;
import { BaseAdapter } from "../base.adapter";
import { SchemaReader } from "./schema.reader";
import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "../../types/crud.types";

export class PrismaAdapter extends BaseAdapter {
  private client: PrismaClient;
  private schemaReader: SchemaReader;

  constructor(client: PrismaClient, schemaPath?: string) {
    super();
    this.client = client;
    this.schemaReader = new SchemaReader(schemaPath);
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

    // Build where clause
    const whereClause: Record<string, unknown> = { ...where, ...filters };

    // Handle search
    if (searchBy && searchValue) {
      whereClause[searchBy] = {
        contains: searchValue,
        mode: "insensitive",
      };
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
    const delegate = this.getDelegate(model);
    const data = await delegate.findFirst({ where: options.where });
    return { data };
  }

  async findById(
    model: string,
    id: string | number
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const data = await delegate.findUnique({ where: { id } });
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
    const data = await delegate.update({
      where: options.where,
      data: options.data,
    });
    return { data };
  }

  async delete(
    model: string,
    options: DeleteOptions
  ): Promise<CrudResult<unknown>> {
    const delegate = this.getDelegate(model);
    const data = await delegate.delete({ where: options.where });
    return { data };
  }
}
