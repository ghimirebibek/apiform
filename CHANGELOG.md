# Changelog

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
