import type { sqliteBinding } from '../../src/utils/development-tooling/sqliteBinding';

export type Field = Parameters<typeof sqliteBinding>[1];
