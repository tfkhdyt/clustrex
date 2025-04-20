import cluster from "node:cluster";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createCluster } from "./index.js";

// Mock the node:os module
vi.mock("node:os", () => ({
  availableParallelism: vi.fn(() => 4), // Mock 4 CPU cores
}));

// Define a mock worker type that works with our tests
interface MockWorker {
  process: {
    pid: number;
  };
}

// Mock the cluster module
vi.mock("node:cluster", () => ({
  default: {
    fork: vi.fn(),
    on: vi.fn(),
    isPrimary: true,
    workers: {
      "1": { kill: vi.fn() },
      "2": { kill: vi.fn() },
    },
  },
}));

// Mock console.log
const originalConsoleLog = console.log;
console.log = vi.fn();

// Mock process
const originalProcessOn = process.on;
const originalProcessExit = process.exit;
process.on = vi.fn();
// @ts-expect-error - We're mocking process.exit which returns never
process.exit = vi.fn();

describe("createCluster", () => {
  const mockPid = 12_345;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save original process.pid and replace with mock value
    Object.defineProperty(process, "pid", {
      value: mockPid,
      configurable: true,
    });

    // Reset cluster.isPrimary to true for each test
    Object.defineProperty(cluster, "isPrimary", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Clean up mocks
    vi.resetAllMocks();
  });

  afterAll(() => {
    // Restore original functions
    console.log = originalConsoleLog;
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  it("should throw error when number of workers exceeds CPU cores", () => {
    const callback = vi.fn();
    const options = { numOfWorkers: 100 }; // More than available CPUs

    expect(() => createCluster(callback, options)).toThrow(
      "numOfWorkers cannot be greater than the number of CPUs (Your CPU has 4 cores)"
    );
  });

  it("should create worker processes when clustering is enabled", () => {
    const callback = vi.fn();
    const options = { numOfWorkers: 2 };

    createCluster(callback, options);

    expect(console.log).toHaveBeenCalledWith(`Primary ${mockPid} is running`);
    expect(cluster.fork).toHaveBeenCalledTimes(2);
    expect(cluster.on).toHaveBeenCalledWith("exit", expect.any(Function));
  });

  it("should not create worker processes when clustering is disabled", () => {
    const callback = vi.fn();
    const options = { enable: false };

    createCluster(callback, options);

    expect(cluster.fork).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(mockPid);
  });

  it("should use default options when none are provided", () => {
    const callback = vi.fn();

    createCluster(callback);

    expect(cluster.fork).toHaveBeenCalledTimes(4); // Default to CPU count
    expect(cluster.on).toHaveBeenCalledWith("exit", expect.any(Function));
  });

  it("should handle worker process termination", () => {
    const callback = vi.fn();
    const options = { numOfWorkers: 1 };

    createCluster(callback, options);

    // Create a mock worker for testing
    const mockWorker: MockWorker = { process: { pid: 5678 } };

    // Type the handler correctly and simulate worker exit
    const exitHandler = vi.mocked(cluster.on).mock.calls[0][1] as (
      worker: MockWorker
    ) => void;
    exitHandler(mockWorker);

    // Verify console output
    expect(console.log).toHaveBeenCalledWith("worker 5678 died");
  });

  it("should register SIGINT and SIGTERM handlers for graceful shutdown", () => {
    const callback = vi.fn();
    const options = { numOfWorkers: 1 };

    createCluster(callback, options);

    // Verify signal handlers are registered
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
  });

  it("should kill all workers during shutdown", () => {
    const callback = vi.fn();
    const options = { numOfWorkers: 2 };

    createCluster(callback, options);

    // Get the shutdown handler
    const shutdownHandler = vi
      .mocked(process.on)
      .mock.calls.find((call) => call[0] === "SIGINT")?.[1];

    expect(shutdownHandler).toBeDefined();

    if (shutdownHandler) {
      // Call the shutdown handler
      shutdownHandler();

      // Verify shutdown behavior
      expect(console.log).toHaveBeenCalledWith("Shutting down gracefully...");
      // Get the mock workers from our mocked cluster
      const mockCluster = cluster as typeof cluster & {
        workers: Record<string, { kill: ReturnType<typeof vi.fn> }>;
      };
      expect(mockCluster.workers["1"]?.kill).toHaveBeenCalled();
      expect(mockCluster.workers["2"]?.kill).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    }
  });

  it("should execute callback in worker process", () => {
    const callback = vi.fn();

    // Set as worker process
    Object.defineProperty(cluster, "isPrimary", {
      value: false,
      configurable: true,
    });

    createCluster(callback);

    expect(callback).toHaveBeenCalledWith(mockPid);
    expect(cluster.fork).not.toHaveBeenCalled();
  });
});
