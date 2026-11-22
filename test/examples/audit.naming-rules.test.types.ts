import type { auditTypeScriptNaming } from '../../src/audit/development-tooling/namingRules';

export type AuditFile = Parameters<typeof auditTypeScriptNaming>[0];
