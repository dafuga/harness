import type { AuditFile } from './adapters/types';
import { auditFunctionNames } from './functionNamingRules';
import { fileName, fileNameFinding } from './namePatterns';
import { auditScaffoldTypeScriptNaming } from './scaffoldNamingRules';
import type { AuditFinding } from './types';

export function auditTypeScriptNaming(file: AuditFile): AuditFinding[] {
	return [...auditFunctionNames(file), ...auditScaffoldTypeScriptNaming(file)];
}

export function auditSqlNaming(file: AuditFile): AuditFinding[] {
	if (!file.relativePath.startsWith('db/migrations/')) return [];
	const stem = fileName(file.relativePath).replace(/\.sql$/, '');
	if (/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(stem)) return [];
	return [
		fileNameFinding(file, 'Migration files should use lowercase kebab-case or snake_case names.')
	];
}
