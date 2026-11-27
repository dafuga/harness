import type { CloudflareDeployAdapter } from '../../src/adapters/development-tooling/CloudflareDeployAdapter';
import type { Options } from '../../src/adapters/development-tooling/CloudflareDeployAdapter.types';

export type Target = Parameters<CloudflareDeployAdapter['deploy']>[0];

export type Command = Parameters<NonNullable<Options['execute']>>[0];

export type Log = { commands: unknown[]; urls: string[] };
