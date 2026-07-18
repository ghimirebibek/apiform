# Changelog

## [0.5.0] - 2026-07-18

### Added

- Field visibility — `omit: string[]` per-model config permanently strips sensitive fields (e.g. passwords) from every response, including included relations; fields stay writable on create/update
- Whitelisted query filters — `filters=` and `searchBy=` are now validated against real scalar fields and a fixed operator set (`equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `contains`, `startsWith`, `endsWith`) instead of being merged straight into the Prisma `where` clause
- `?fields=` query parameter for response field projection
- Lifecycle hooks — `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeFindAll`, `afterFindAll`, `beforeFindById`, `afterFindById` per model via `hooks` config
- OpenAPI / Swagger UI generation — opt-in via `openapi: { enabled: true }`, served at `/docs` (raw spec at `/docs/json`)
- Enum support in Prisma schema parsing — enum fields are now validated against their real members instead of accepting any value

### Fixed

- `findById`/`update`/`delete`/`restore` now resolve the model's actual `@id` field name and type instead of assuming a field named `id` and guessing numeric-vs-string coercion from the value
- `GET /:id` now honors `?include=`, which was previously silently ignored
- `restore`/`findDeleted` routes are now correctly opt-in (disabled by default) as already documented — a config bug previously registered them regardless of settings
- Writable-field exclusion for create/update no longer hardcodes literal `createdAt`/`updatedAt`/`deletedAt` field names — now derived from schema attributes and the resolved (possibly renamed) soft-delete field
- The writable-field whitelist is now actually applied to what gets persisted, not just used for validation
- Validation errors now correctly return `400 VALIDATION_ERROR` instead of `500 INTERNAL_ERROR` (stale Zod v3 error-shape detection)
- Soft-deleted records are now correctly excluded from `GET /:id`, matching documented behavior
- Omitted fields can no longer be probed indirectly via `filters=`/`searchBy=`

## [0.4.0] - 2026-03-06

### Added

- Rate limiting support via `@fastify/rate-limit`
- Global rate limit via `rateLimit: { max, timeWindow }` in config
- Per route rate limit override via `rateLimit` in route options
- Returns custom `RATE_LIMIT_EXCEEDED` error response shape

## [0.3.0] - 2026-03-06

### Added

- Role-Based Access Control (RBAC) support
- `rbac.rolesPath` — configurable path to roles on request (default: `user.roles`)
- `rbac.globalRoles` — roles required for all routes
- Per route role override via `roles: ["admin"]` in route options
- Returns 403 FORBIDDEN when user lacks required role

## [0.2.0] - 2026-03-05

### Added

- Soft delete support — models with `deletedAt DateTime?` field automatically use soft delete
- `GET /api/:model/deleted` — retrieve soft deleted records
- `PATCH /api/:model/:id/restore` — restore a soft deleted record
- Custom soft delete field name support via `softDelete: "field_name"` config
- `addRoutes()` method for adding custom routes on top of generated ones
- Route overriding support via `addRoutes()`
- Better TypeScript generics — all CRUD operations now support typed responses e.g. `crud.findById<User>("user", 1)`
- Nested/related models support via `?include=relation1,relation2` query parameter on all GET endpoints

### Fixed

- Correct HTTP status codes on error responses (404, 409, 400, 500)
- Input validation on create and update routes using Zod
- Bundle size reduced from 1.71MB to 27KB by externalizing Fastify, Zod and Prisma dependencies

## [0.1.0] - 2026-03-05

### Added

- Initial release
- Auto-generated CRUD routes from Prisma schema
- Consistent response shape across all endpoints
- Built-in pagination, search, sorting and filtering
- Fully customizable routes and middleware
- TypeScript first with full type safety
- Fastify powered HTTP layer
