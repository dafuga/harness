import type { githubTransport } from './githubTransport';

export type Request = { method?: string; body?: unknown; statuses?: number[] };

export type GitHubTransport = ReturnType<typeof githubTransport>;
