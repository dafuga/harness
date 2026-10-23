export type Call = { method: string; input: Record<string, unknown> };

export type Answer = { value: unknown; cachedAt?: string };
