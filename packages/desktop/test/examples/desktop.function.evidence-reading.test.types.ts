import type { evidenceReading } from '../../src/utils/verification-evidence/evidenceReading';

export type Bridge = Parameters<typeof evidenceReading>[0];

export type Result = Parameters<typeof evidenceReading>[1];

export type Scope = Parameters<typeof evidenceReading>[2];

export type Side = NonNullable<Result['evidence']['after']>;

export type Captured = Side['captures'][number];

export type Row = Result['behavior']['rows'][number];
