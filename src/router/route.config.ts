import type {
  ApiFormConfig,
  ModelRouteConfig,
  RouteOptions,
} from "../types/config.types";

const DEFAULT_ROUTE_OPTIONS: RouteOptions = {
  enabled: true,
  middleware: [],
};

const DEFAULT_MODEL_ROUTE_CONFIG: ModelRouteConfig = {
  create: { ...DEFAULT_ROUTE_OPTIONS },
  findAll: { ...DEFAULT_ROUTE_OPTIONS },
  findById: { ...DEFAULT_ROUTE_OPTIONS },
  update: { ...DEFAULT_ROUTE_OPTIONS },
  delete: { ...DEFAULT_ROUTE_OPTIONS },
  prefix: undefined,
};

export class RouteConfig {
  private config: ApiFormConfig;

  constructor(config: ApiFormConfig = {}) {
    this.config = config;
  }

  getGlobalPrefix(): string {
    return this.config.globalPrefix ?? "/api";
  }

  getGlobalMiddleware() {
    return this.config.globalMiddleware ?? [];
  }

  getModelConfig(modelName: string): ModelRouteConfig {
    const name = modelName.toLowerCase();
    const modelConfig = this.config.models?.[name];

    // if model is set to false, disable all routes
    if (modelConfig === false) {
      return {
        create: { enabled: false },
        findAll: { enabled: false },
        findById: { enabled: false },
        update: { enabled: false },
        delete: { enabled: false },
      };
    }

    // if model is set to true or not set, use all defaults
    if (modelConfig === true || modelConfig === undefined) {
      return { ...DEFAULT_MODEL_ROUTE_CONFIG };
    }

    // merge user config with defaults
    return {
      create: this.mergeRouteOptions(modelConfig.create),
      findAll: this.mergeRouteOptions(modelConfig.findAll),
      findById: this.mergeRouteOptions(modelConfig.findById),
      update: this.mergeRouteOptions(modelConfig.update),
      delete: this.mergeRouteOptions(modelConfig.delete),
      prefix: modelConfig.prefix,
    };
  }

  isModelEnabled(modelName: string): boolean {
    const name = modelName.toLowerCase();
    const modelConfig = this.config.models?.[name];
    return modelConfig !== false;
  }

  isRouteEnabled(modelName: string, route: keyof ModelRouteConfig): boolean {
    const modelConfig = this.getModelConfig(modelName);
    const routeConfig = modelConfig[route];

    if (typeof routeConfig === "object" && routeConfig !== null) {
      return (routeConfig as RouteOptions).enabled !== false;
    }

    return true;
  }

  getModelPrefix(modelName: string): string {
    const modelConfig = this.getModelConfig(modelName);
    const globalPrefix = this.getGlobalPrefix();
    const modelPrefix = modelConfig.prefix ?? `/${modelName.toLowerCase()}s`;
    return `${globalPrefix}${modelPrefix}`;
  }

  private mergeRouteOptions(options?: RouteOptions): RouteOptions {
    return {
      ...DEFAULT_ROUTE_OPTIONS,
      ...options,
    };
  }
}
