import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "../types/crud.types";
import type { ModelDefinition } from "../types/adapter.types";

export abstract class BaseAdapter {
  protected models: ModelDefinition[] = [];

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract findAll(
    model: string,
    options: FindAllOptions
  ): Promise<CrudResult<unknown[]>>;

  abstract findOne(
    model: string,
    options: FindOneOptions
  ): Promise<CrudResult<unknown>>;

  abstract findById(
    model: string,
    id: string | number,
    include?: Record<string, boolean>
  ): Promise<CrudResult<unknown>>;

  abstract create(
    model: string,
    options: CreateOptions
  ): Promise<CrudResult<unknown>>;

  abstract update(
    model: string,
    options: UpdateOptions
  ): Promise<CrudResult<unknown>>;

  abstract delete(
    model: string,
    options: DeleteOptions
  ): Promise<CrudResult<unknown>>;

  getModels(): ModelDefinition[] {
    return this.models;
  }

  getModel(name: string): ModelDefinition | undefined {
    return this.models.find((m) => m.name.toLowerCase() === name.toLowerCase());
  }

  hasModel(name: string): boolean {
    return this.models.some((m) => m.name.toLowerCase() === name.toLowerCase());
  }
}
