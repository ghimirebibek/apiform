import type {
  FindAllOptions,
  FindOneOptions,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  CrudResult,
} from "./crud.types";

export interface IAdapter {
  findAll(
    model: string,
    options: FindAllOptions
  ): Promise<CrudResult<unknown[]>>;
  findOne(model: string, options: FindOneOptions): Promise<CrudResult<unknown>>;
  findById(model: string, id: string | number): Promise<CrudResult<unknown>>;
  create(model: string, options: CreateOptions): Promise<CrudResult<unknown>>;
  update(model: string, options: UpdateOptions): Promise<CrudResult<unknown>>;
  delete(model: string, options: DeleteOptions): Promise<CrudResult<unknown>>;
}

export interface ModelField {
  name: string;
  type: string;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  default?: unknown;
}

export interface ModelDefinition {
  name: string;
  fields: ModelField[];
}

export interface AdapterConfig {
  models: ModelDefinition[];
}
