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
- **Fully customizable** — disable routes, add middleware, change prefixes per model
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

## Configuration Reference

```ts
new ApiForm(prismaClient, {
  globalPrefix?: string;        // default: "/api"
  globalMiddleware?: Function[]; // runs before every route
  schemaPath?: string;          // custom path to schema.prisma
  models?: {
    [modelName]: boolean | {
      prefix?: string;
      create?: RouteOptions;
      findAll?: RouteOptions;
      findById?: RouteOptions;
      update?: RouteOptions;
      delete?: RouteOptions;
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
