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

| Parameter     | Type            | Description                           |
| ------------- | --------------- | ------------------------------------- |
| `page`        | number          | Page number (default: 1)              |
| `limit`       | number          | Items per page (default: 10)          |
| `searchBy`    | string          | Field name to search on               |
| `searchValue` | string          | Value to search for                   |
| `sortBy`      | string          | Field to sort by (default: createdAt) |
| `sortOrder`   | `asc` or `desc` | Sort direction (default: desc)        |
| `filters`     | JSON string     | Additional field filters              |

**Example:**

```
GET /api/users?page=2&limit=5&searchBy=name&searchValue=john&sortBy=createdAt&sortOrder=desc
```

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

## Configuration Reference

```ts
new ApiForm(prismaClient, {
  globalPrefix?: string;         // default: "/api"
  globalMiddleware?: Function[];  // runs before every route
  schemaPath?: string;           // custom path to schema.prisma
  models?: {
    [modelName]: boolean | {
      prefix?: string;
      softDelete?: boolean | string; // true = use deletedAt, string = custom field name
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
  enabled?: boolean;       // default: true
  middleware?: Function[]; // route-level middleware
}
```

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

MIT © [Bibek Ghimire](https://github.com/ghimirebibek)
