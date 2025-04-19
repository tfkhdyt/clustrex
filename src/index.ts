import cluster from "node:cluster";
import { availableParallelism } from "node:os";

/**
 * The number of CPU cores available on the system
 */
const numCPUs = availableParallelism();

/**
 * Forks the specified number of worker processes using Node.js cluster module
 * @param numOfWorkers - The number of worker processes to create
 * @throws Error if numOfWorkers exceeds available CPU cores
 */
function createWorkerProcesses(numOfWorkers: number) {
  if (numOfWorkers > numCPUs) {
    throw new Error(
      `numOfWorkers cannot be greater than the number of CPUs (Your CPU has ${numCPUs} cores)`,
    );
  }

  console.log(`Primary ${process.pid} is running`);

  // Create worker processes
  for (let i = 0; i < numOfWorkers; i++) {
    cluster.fork();
  }

  // Handle worker process termination
  cluster.on("exit", (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });

  // Handle SIGINT (Ctrl+C) and SIGTERM for the primary process
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Configuration options for the worker processes
 */
type Options = {
  /** Whether to enable clustering (default: true) */
  enable?: boolean;
  /** Number of worker processes to create (default: number of CPU cores) */
  numOfWorkers?: number;
};

/**
 * Sets up worker processes using Node.js cluster module
 * @param cb - Callback function to execute in worker processes
 * @param opts - Configuration options for worker processes
 */
export function createCluster(cb: () => void | Promise<void>, opts?: Options) {
  const { enable = true, numOfWorkers = numCPUs } = opts ?? {};

  if (enable) {
    if (cluster.isPrimary) {
      createWorkerProcesses(numOfWorkers);
    } else {
      cb();
    }
  } else {
    cb();
  }
}
