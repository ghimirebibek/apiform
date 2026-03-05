# Changelog

## [0.2.0] - Unreleased

### Added

- Soft delete support — models with `deletedAt DateTime?` field automatically use soft delete
- `GET /api/:model/deleted` — retrieve soft deleted records
- `PATCH /api/:model/:id/restore` — restore a soft deleted record
- Custom soft delete field name support via `softDelete: "field_name"` config
- `addRoutes()` method for adding custom routes on top of generated ones
- Route overriding support via `addRoutes()`

## [0.1.0] - 2026-03-05

### Added

- Initial release
- Auto-generated CRUD routes from Prisma schema
- Consistent response shape across all endpoints
- Built-in pagination, search, sorting and filtering
- Fully customizable routes and middleware
- TypeScript first with full type safety
- Fastify powered HTTP layer
