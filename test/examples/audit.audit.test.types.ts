import type { auditPath } from '../../src/audit/development-tooling/audit';
import type { AuditResult } from '../../src/audit/development-tooling/adapters/types';

/**
 * Each public operation is called on a temporary project folder, with the options runAudit passes
 * to auditProject. What it was given and what it returned, or why it refused, is asserted and
 * recorded as the cases of its state. Temporary paths are recorded as the names they stand for,
 * and listings are sorted because directory order differs between file systems.
 */
export type Files = Record<string, string>;

export type Options = Parameters<typeof auditPath>[1];

export type Finding = AuditResult['findings'][number];
