import type { CheckRunService } from '../../src/services/check-run-service/CheckRunService';

export type CheckInput = Parameters<CheckRunService['run']>[0];
export type ToolCheck = Parameters<CheckRunService['version']>[0];
export type DiagnosticsExit = 0 | 1;
export type RefusedDiagnostics = 'malformed' | 'timeout';
