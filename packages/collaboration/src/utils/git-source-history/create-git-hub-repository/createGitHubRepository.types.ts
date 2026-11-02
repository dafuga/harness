// @harness-uid u_psyobbtuku
import type { GitHubTransport } from '../githubTransport';

export type Context = { client: GitHubTransport; ref: string; path: string };
