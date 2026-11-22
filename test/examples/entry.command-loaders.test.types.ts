import type { commandLoaders } from '../../src/cli/commandLoaders';

export type LoaderName = keyof typeof commandLoaders;

export type LoaderCase = { name: string; input: unknown; output: unknown };
