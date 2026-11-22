import type { responseCheckSettings } from '../../src/cli/program/responseCheckInput';

export type ResponseOptions = Parameters<typeof responseCheckSettings>[0];

export type ErrorCase = { name: string; input: unknown; error: unknown };
