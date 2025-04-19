# Clustrex

A simple and efficient TypeScript library for creating clustered Node.js applications using the built-in cluster module.

## Features

- Easy-to-use API for creating worker processes
- Automatic CPU core detection
- Graceful shutdown handling for both primary and worker processes
- Configurable number of worker processes
- TypeScript support out of the box

## Installation

```bash
npm install clustrex
# or
yarn add clustrex
# or
pnpm add clustrex
```

## Usage

Here's a basic example of how to use Clustrex with a Hono web server:

```typescript
import { serve } from "@hono/node-server";
import { createCluster } from "clustrex";
import { Hono } from "hono";
import process from "node:process";

createCluster(
  () => {
    const app = new Hono();

    app.get("/:name", (c) => {
      const name = c.req.param("name");

      return c.json({
        message: `Hello ${name}!`,
      });
    });

    const server = serve(
      {
        fetch: app.fetch,
        port: 3000,
      },
      (info) => {
        console.log(
          `Server (${process.pid}) is running on http://localhost:${info.port}`
        );
      }
    );

    // Handle SIGINT (Ctrl+C) and SIGTERM for worker processes
    const shutdown = () => {
      console.log(`Worker ${process.pid} shutting down...`);
      server.close(() => {
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  },
  { enable: process.env.NODE_ENV === "production" }
);
```

## API

### `createCluster(callback: () => void | Promise<void>, options?: Options)`

Creates a cluster of worker processes that execute the provided callback function.

#### Parameters

- `callback`: A function that will be executed in each worker process. The function can be synchronous or return a Promise.
- `options`: Optional configuration object with the following properties:
  - `enable`: Whether to enable clustering. When set to `false`, the callback will run in the main process. Defaults to `true`.
  - `numOfWorkers`: Number of worker processes to create. Cannot exceed the number of available CPU cores. Defaults to the number of CPU cores on the system.

## Error Handling

The library includes built-in error handling for common scenarios:

- Throws an error if the requested number of workers exceeds available CPU cores
- Gracefully handles process termination signals (SIGINT, SIGTERM)

## When Not to Use This Library

While Clustrex is great for many use cases, there are scenarios where you might want to consider alternatives:

- **Single-threaded Applications**: If your application doesn't benefit from parallel processing or doesn't handle CPU-intensive tasks, the overhead of managing multiple processes might not be worth it.
- **Memory-constrained Environments**: Each worker process creates a separate instance of your application, which means increased memory usage. If you're running in a memory-constrained environment, this might not be ideal.

## License

ISC
