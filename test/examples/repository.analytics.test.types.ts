// AnalyticsRepository needs bun:sqlite, which the Node-hosted vitest run cannot load,
// so each test sends its steps to a bun child process that calls the real repository.
export type Step = Record<string, unknown>;
