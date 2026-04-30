import { auditFileLength } from '../commonRules';
import { auditCurlyFunctions } from './blockHelpers';
import type { AuditAdapter, AuditFile } from './types';

export const shellAdapter: AuditAdapter = {
	id: 'shell',
	label: 'Shell',
	profiles: ['lib'],
	extensions: ['.sh'],
	optionalTools: ['shellcheck'],
	audit(file) {
		return [
			...auditFileLength(file.relativePath, file.lines),
			...auditShebang(file),
			...auditStrictMode(file),
			...auditUnsafeRm(file),
			...auditUnquotedVariable(file),
			...auditCurlyFunctions(file.relativePath, file.lines, startsShellFunction)
		];
	}
};

function auditShebang(file: AuditFile) {
	if (file.lines[0]?.startsWith('#!')) return [];
	return [{ path: file.relativePath, rule: 'shell-shebang', message: 'Shell scripts should start with a shebang.' }];
}

function auditStrictMode(file: AuditFile) {
	if (file.contents.includes('set -euo pipefail')) return [];
	return [{ path: file.relativePath, rule: 'shell-strict-mode', message: 'Shell scripts should use set -euo pipefail.' }];
}

function auditUnsafeRm(file: AuditFile) {
	if (!/\brm\s+-rf\s+(\$|\/|\*)/.test(file.contents)) return [];
	return [{ path: file.relativePath, rule: 'shell-unsafe-rm', message: 'Avoid broad rm -rf patterns.' }];
}

function auditUnquotedVariable(file: AuditFile) {
	if (!file.lines.some((line) => /\s\$\w+/.test(line) && !/"[^"]*\$\w+[^"]*"/.test(line))) return [];
	return [{ path: file.relativePath, rule: 'shell-unquoted-variable', message: 'Quote shell variables in command arguments.' }];
}

function startsShellFunction(line: string): boolean {
	return /^\s*(function\s+)?\w+\s*\(\)\s*\{/.test(line);
}
