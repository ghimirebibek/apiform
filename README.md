# apiform

> Auto-generate CRUD REST API routes from your Prisma schema — with consistent responses, pagination, search, and full customization.

[![npm version](https://img.shields.io/npm/v/apiform.svg)](https://www.npmjs.com/package/apiform)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is apiform?

`apiform` sits on top of your existing Prisma setup and automatically generates a fully structured REST API from your models. No writing controllers. No repetitive route handlers. Just plug in your Prisma client and your API is ready.

```
Your Prisma Schema → apiform → Fully structured REST API
```

Every route returns a consistent, predictable response shape — making your API easier to consume and debug.

---

## Features

- **Auto-generated CRUD routes** from your Prisma schema
- **Consistent response shape** across all endpoints
- **Built-in pagination, search, sorting, and filtering** on all `GET` list endpoints
- **Soft delete support** — automatic soft delete for models with `deletedAt` field
- **Nested relations** — include related models via `?include=` query parameter
- **TypeScript generics** — fully typed responses out of the box
- **Role-Based Access Control (RBAC)** — global and per-route role protection
- **Rate limiting** — global and per-route rate limiting out of the box
- **Fully customizable** — disable routes, add middleware, change prefixes per model
- **Custom routes** — add your own routes on top of generated ones
- **TypeScript first** — full type safety and intellisense out of the box
- **Fastify powered** — fast and lightweight HTTP layer

---

## Requirements

- Node.js >= 20
- Prisma >= 7.0.0
- TypeScript >= 5.0.0

---

## Installation

```bash
npm install apiform
# or
bun add apiform
```

---

## Quick Start

**1. Set up your Prisma client (Prisma v7 requires an adapter):**

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });
```

**2. Pass it to `ApiForm` and start the server:**

```ts
import { ApiForm } from "apiform";

const app = new ApiForm(prisma, {
  globalPrefix: "/api",
  models: {
    user: true,
    post: true,
  },
});

app.start(3000);
```

That's it. Your API is running with the following routes auto-generated for each model:

| Method | Route            | Action               |
| ------ | ---------------- | -------------------- |
| GET    | `/api/users`     | Find all (paginated) |
| GET    | `/api/users/:id` | Find by ID           |
| POST   | `/api/users`     | Create               |
| PATCH  | `/api/users/:id` | Update               |
| DELETE | `/api/users/:id` | Delete               |

---

## Response Shape

Every endpoint returns the same consistent structure:

**Success (single record):**

```json
{
  "success": true,
  "message": "USER_CREATED_SUCCESSFULLY",
  "data": {},
  "meta": null,
  "error": null
}
```

**Success (list):**

```json
{
  "success": true,
  "message": "USERS_RETRIEVED_SUCCESSFULLY",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "error": null
}
```

**Error:**

```json
{
  "success": false,
  "message": "VALIDATION_ERROR",
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

---

## Pagination, Search & Filtering

All `GET` list endpoints support the following query parameters out of the box:

| Parameter     | Type            | Description                              |
| ------------- | --------------- | ----------------------------------------- |
| `page`        | number          | Page number (default: 1)                  |
| `limit`       | number          | Items per page (default: 10)               |
| `searchBy`    | string          | Field name to search on                    |
| `searchValue` | string          | Value to search for                        |
| `sortBy`      | string          | Field to sort by (default: createdAt)      |
| `sortOrder`   | `asc` or `desc` | Sort direction (default: desc)             |
| `filters`     | JSON string     | Additional field filters (see below)       |
| `fields`      | comma-separated | Project the response down to these fields  |

**Example:**

```
GET /api/users?page=2&limit=5&searchBy=name&searchValue=john&sortBy=createdAt&sortOrder=desc
GET /api/users?fields=id,name,email
```

### Filtering

`filters` is sanitized before it ever reaches the database — apiform is not a passthrough for arbitrary Prisma `where` clauses. Only fields that exist as **scalar, non-relation** columns on the model may be filtered, and only a fixed set of operators is honored:

`equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `contains`, `startsWith`, `endsWith`

Anything else — relation fields, unknown fields, Prisma logical operators like `OR`/`AND`, unrecognized operators — is silently dropped rather than forwarded to the query engine. The same whitelist applies to `searchBy`.

```
GET /api/users?filters={"age":{"gte":18,"lte":65}}
GET /api/users?filters={"role":{"in":["admin","editor"]}}
```

`?fields=` works the same way in reverse: it's a client-side projection applied **after** any server-side `omit` config (see below), so a client can never use `fields` to pull back a field the server has hidden.

---

## Customization

### Disable a specific route

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      delete: { enabled: false },
    },
  },
});
```

### Add middleware to a route

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      findAll: {
        middleware: [authMiddleware],
      },
    },
  },
});
```

### Custom route prefix per model

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      prefix: "/members",
    },
  },
});
// Routes: GET /api/members, POST /api/members, etc.
```

### Global middleware

```ts
const app = new ApiForm(prisma, {
  globalMiddleware: [loggingMiddleware, authMiddleware],
  models: {
    user: true,
  },
});
```

### Disable an entire model

```ts
const app = new ApiForm(prisma, {
  models: {
    user: true,
    post: false, // no routes generated for Post
  },
});
```

### Add custom routes

Use `addRoutes()` to add your own routes on top of the auto-generated ones. Custom routes are always registered **after** apiform's routes, so they won't be overwritten.

```ts
const app = new ApiForm(prisma, {
  globalPrefix: "/api",
  models: { user: true },
});

app.addRoutes((fastify) => {
  fastify.get("/api/users/count", async (request, reply) => {
    const count = await prisma.user.count();
    reply.send({
      success: true,
      message: "USERS_COUNTED_SUCCESSFULLY",
      data: { count },
      meta: null,
      error: null,
    });
  });
});

app.start(3000);
```

`addRoutes()` is chainable — you can call it multiple times:

```ts
app.addRoutes(userRoutes).addRoutes(postRoutes).start(3000);
```

### Override a generated route

To override one of apiform's auto-generated routes, simply register the same method and path inside `addRoutes()`. Since custom routes are registered after apiform's routes, yours will take precedence:

```ts
app.addRoutes((fastify) => {
  // Overrides apiform's default GET /api/users
  fastify.get("/api/users", async (request, reply) => {
    // your custom implementation
  });
});
```

---

## Lifecycle Hooks

`addRoutes()` overrides an entire route — you lose pagination, RBAC, rate limiting, and field masking and have to reimplement them yourself. Lifecycle hooks let you inject logic into apiform's own generated routes instead, without giving any of that up.

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      hooks: {
        beforeCreate: async (data, ctx) => {
          return { ...data, password: await hash(data.password as string) };
        },
        afterCreate: (record, ctx) => {
          sendWelcomeEmail(record);
          return record;
        },
        beforeFindAll: (options, ctx) => ({
          ...options,
          where: { ...options.where, tenantId: ctx.request.user.tenantId },
        }),
      },
    },
  },
});
```

**Available hooks:** `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeFindAll`, `afterFindAll`, `beforeFindById`, `afterFindById`.

**How it works:**

- Every hook receives a `ctx: { model: string; request: FastifyRequest }` as its last argument, so you can read `request.user`, headers, etc.
- `beforeCreate`/`beforeUpdate` run **after** the writable-field whitelist has already validated and stripped the request body — so they can safely add fields (like `tenantId`, a hashed password, an audit user id) that a client isn't allowed to set directly. Whatever the hook returns becomes the data that's written.
- `after*` hooks receive the record apiform is about to return and must return the (optionally modified) value that actually gets sent to the client.
- `beforeFindAll` receives the resolved query options (`where`, `filters`, `page`, etc.) and must return the options to actually run — this is the mechanism for tenant/row-level scoping.
- `beforeDelete`/`beforeFindById` don't return data; throw inside them to abort the operation. A thrown error is turned into a normal error response (500 by default) — if you need a specific HTTP status for a rejection, use route-level `middleware` instead, which has direct access to `reply`.
- Hooks are per-model, not per-route — they run regardless of whether the request came from an auto-generated route.

---

## Soft Delete

Models with a `deletedAt DateTime?` field automatically use soft delete — records are never permanently deleted, just marked with a timestamp.

**Add `deletedAt` to your Prisma model:**

```prisma
model User {
  id        Int       @id @default(autoincrement())
  name      String
  email     String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
}
```

**Auto-generated soft delete routes:**

| Method | Route                    | Action                        |
| ------ | ------------------------ | ----------------------------- |
| DELETE | `/api/users/:id`         | Soft delete (sets deletedAt)  |
| GET    | `/api/users/deleted`     | Find all soft deleted records |
| PATCH  | `/api/users/:id/restore` | Restore a soft deleted record |

Soft deleted records are automatically excluded from all `GET` list and `findById` queries.

**Enable soft delete routes in config:**

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      findDeleted: { enabled: true },
      restore: { enabled: true },
    },
  },
});
```

**Custom soft delete field name:**

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      softDelete: "deleted_at", // use custom field name
    },
  },
});
```

### ⚠️ Soft Delete & Relations

apiform does not prevent linking records to soft deleted related records. It is the developer's responsibility to ensure relation integrity via custom middleware, application-level validation, or Prisma's referential actions.

---

## Role-Based Access Control (RBAC)

Protect your auto-generated routes with role-based access control. apiform checks the user's roles from the request and returns `403 FORBIDDEN` if they don't have the required role.

**Setup:**

```ts
const app = new ApiForm(prisma, {
  rbac: {
    rolesPath: "user.roles", // where to find roles on the request (default: "user.roles")
    globalRoles: ["user"], // roles required for ALL routes
  },
  models: {
    user: {
      findAll: { roles: ["admin"] }, // override — only admin can list users
      delete: { roles: ["admin"] }, // override — only admin can delete
    },
  },
});
```

**How it works:**

- `globalRoles` applies to every route unless overridden
- Per-route `roles` overrides `globalRoles` for that specific route
- If no roles are configured, the route is public
- Roles are looked up from the request using `rolesPath` (supports dot notation e.g. `auth.user.roles`)

**Custom roles path:**

```ts
rbac: {
  rolesPath: "auth.roles",  // looks at request.auth.roles
}
```

**Response when access is denied:**

```json
{
  "success": false,
  "message": "You do not have permission to access this resource",
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN"
  }
}
```

> **Note:** apiform does not handle authentication — it only checks roles. You are responsible for populating `request.user` (or your custom path) via your own auth middleware before apiform's RBAC runs.

---

## Field Visibility

By default, every field on a model is returned in API responses — including things like password hashes or internal notes. Use `omit` to permanently hide fields from every response for a model, regardless of `select`, `include`, or `fields=`:

```ts
const app = new ApiForm(prisma, {
  models: {
    user: {
      omit: ["password", "internalNotes"],
    },
  },
});
```

**How it works:**

- Omitted fields are stripped from `findAll`, `findById`, `create`, `update`, `delete`, `restore`, and `findDeleted` responses.
- Omitted fields are **still writable** on `create`/`update` — this is what makes `omit` useful for a field like `password`: clients can set it, but it's never echoed back.
- Omission is enforced server-side, after the database query. A client cannot use `?fields=` or `?include=` to get an omitted field back.
- When you `?include=` a relation, the related model's own `omit` config is applied too. If `Post` includes `author` and `User` has `omit: ["password"]`, `GET /api/posts?include=author` will never leak `author.password`.

---

## TypeScript Generics

All CRUD operations support TypeScript generics for fully typed responses:

```ts
import type { User } from "@prisma/client";

const result = await crud.findById<User>("user", 1);
result.data.email; // ✅ typed as string
result.data.name; // ✅ typed as string

const list = await crud.findAll<User>("user", {});
list.data; // ✅ typed as User[]
```

---

## Nested Relations

Include related models in your queries using the `?include=` query parameter:

```
GET /api/posts?include=author
GET /api/users/1?include=posts
GET /api/posts?include=author,comments
```

**Example response with included relation:**

```json
{
  "success": true,
  "message": "POSTS_RETRIEVED_SUCCESSFULLY",
  "data": [
    {
      "id": 1,
      "title": "Hello World",
      "author": {
        "id": 1,
        "name": "John Doe"
      }
    }
  ],
  "meta": { ... },
  "error": null
}
```

---

## Rate Limiting

Protect your API from abuse with built-in rate limiting powered by `@fastify/rate-limit`.

**Global rate limit:**

```ts
const app = new ApiForm(prisma, {
  rateLimit: {
    max: 100, // maximum requests
    timeWindow: 60, // per 60 seconds
  },
  models: {
    user: true,
  },
});
```

**Per route override:**

```ts
const app = new ApiForm(prisma, {
  rateLimit: {
    max: 100,
    timeWindow: 60,
  },
  models: {
    user: {
      create: { rateLimit: { max: 10, timeWindow: 60 } }, // stricter on create
    },
  },
});
```

**Response when rate limit is exceeded:**

```json
{
  "success": false,
  "message": "RATE_LIMIT_EXCEEDED",
  "data": null,
  "meta": null,
  "error": {
    "code": "TOO_MANY_REQUESTS"
  }
}
```

Rate limit headers are automatically included in every response:

- `x-ratelimit-limit` — maximum requests allowed
- `x-ratelimit-remaining` — requests remaining in current window
- `x-ratelimit-reset` — seconds until the window resets

---

## Configuration Reference

```ts
new ApiForm(prismaClient, {
  globalPrefix?: string;          // default: "/api"
  globalMiddleware?: Function[];   // runs before every route
  schemaPath?: string;            // custom path to schema.prisma
  rateLimit?: {
    max: number;                  // maximum requests
    timeWindow: number;           // time window in seconds
  };
  rbac?: {
    rolesPath?: string;           // default: "user.roles"
    globalRoles?: string[];       // roles required for all routes
  };
  models?: {
    [modelName]: boolean | {
      prefix?: string;
      softDelete?: boolean | string;
      omit?: string[];         // fields always stripped from responses
      hooks?: ModelHooks;      // lifecycle hooks (see "Lifecycle Hooks")
      create?: RouteOptions;
      findAll?: RouteOptions;
      findById?: RouteOptions;
      update?: RouteOptions;
      delete?: RouteOptions;
      restore?: RouteOptions;
      findDeleted?: RouteOptions;
    }
  }
});

// RouteOptions
{
  enabled?: boolean;        // default: true
  middleware?: Function[];  // route-level middleware
  roles?: string[];         // roles required for this route
  rateLimit?: {
    max: number;            // override global rate limit
    timeWindow: number;     // time window in seconds
  };
}
```

---

## Request Validation

`create`/`update` request bodies are validated against a schema derived from your Prisma model, before anything reaches the database:

- Scalar fields are checked against their Prisma type (`String`, `Int`, `Boolean`, `DateTime`, `Json`, etc.).
- **Enum fields are validated against the enum's actual members** — `role: "SUPERADMIN"` is rejected if your `enum Role { ADMIN EDITOR VIEWER }` doesn't include it.
- The primary key, `@updatedAt` fields, any field with an auto-generated default (`@default(now())`, `@default(autoincrement())`, etc.), and the resolved soft-delete field are never client-writable — even if the client includes them in the request body, they're stripped before the write, not just before the response.

---

## Error Codes

| Code               | Description                    |
| ------------------ | ------------------------------ |
| `VALIDATION_ERROR` | Request body failed validation |
| `NOT_FOUND`        | Record not found               |
| `CONFLICT`         | Unique constraint violation    |
| `BAD_REQUEST`      | Invalid request                |
| `INTERNAL_ERROR`   | Unexpected server error        |
| `UNAUTHORIZED`     | Unauthorized access            |
| `FORBIDDEN`        | Forbidden access               |

---

## License

MIT © [Bibek Raj Ghimire](https://github.com/ghimirebibek)
