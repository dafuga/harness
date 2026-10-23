import type { Buffer } from 'node:buffer';

export type Files = Map<string, { text: string; bytes: Buffer; oid: string }>;

export type State = { mode: string; cancelled: number };
