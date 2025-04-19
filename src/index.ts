import cluster from "node:cluster";
import { availableParallelism } from "node:os";

/**
 * The number of CPU cores available on the system.
 */
const numberCPUs = availableParallelism();

/**
 * Forks the specified number of worker processes using Node.js cluster module.
 *
 * @param numberOfWorkers - The number of worker processes to create
 * @throws {Error} If numberOfWorkers exceeds available CPU cores
 */
function createWorkerProcesses(numberOfWorkers: number) {
  if (numberOfWorkers > numberCPUs) {
    throw new Error(
      `numOfWorkers cannot be greater than the number of CPUs (Your CPU has ${numberCPUs} cores)`
    );
  }

  console.log(`Primary ${process.pid} is running`);

  // Create worker processes
  for (let index = 0; index < numberOfWorkers; index++) {
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
 * Configuration options for the worker processes.
 */
type Options = {
  /** Whether to enable clustering. Defaults to true. */
  enable?: boolean;
  /** Number of worker processes to create. Defaults to number of CPU cores. */
  numOfWorkers?: number;
};

/**
 * Sets up worker processes using Node.js cluster module.
 *
 * @param callback - Function to execute in worker processes
 * @param options - Configuration options for worker processes
 */
export function createCluster(
  callback: () => void | Promise<void>,
  options?: Options
) {
  const { enable = true, numOfWorkers: numberOfWorkers = numberCPUs } =
    options ?? {};

  if (enable) {
    if (cluster.isPrimary) {
      createWorkerProcesses(numberOfWorkers);
    } else {
      callback();
    }
  } else {
    callback();
  }
}
