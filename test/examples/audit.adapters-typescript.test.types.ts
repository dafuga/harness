import type { AuditFinding } from '../../src/audit/development-tooling/types';

/**
 * The TypeScript and JavaScript adapter is called the way the project auditor calls it. Each file
 * is split into the lines the rules read, then audit(file) returns its findings. Its declared
 * auditStructure is called with a project's file and folder lists. What it was given and what it
 * returned is asserted and recorded as the cases of its state.
 */
export type Outcome = { name: string; input: unknown; output: AuditFinding[] };
