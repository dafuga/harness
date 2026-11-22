import type { pickerMcpTools } from '../../src/utils/development-tooling/pickerMcpTools';

export type Service = Parameters<typeof pickerMcpTools>[0];

export type Call = { member: string; args: unknown[] };
