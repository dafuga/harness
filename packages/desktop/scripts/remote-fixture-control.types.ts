/** One control operation: `METHOD /path` → what it answers. */
export type FixtureAction = (body: Record<string, unknown>) => unknown;
