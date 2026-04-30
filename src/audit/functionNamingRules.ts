import type { AuditFile } from './adapters/types';
import { escapeRegExp, fileName, isCamelCase, isPascalCase } from './namePatterns';
import type { AuditFinding } from './types';

const httpHandlerNames = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);

export function auditFunctionNames(file: AuditFile): AuditFinding[] {
	return functionNames(file.structuralLines).flatMap((name) => {
		if (isAllowedFunctionName(file, name)) return [];
		return [
			{
				path: file.relativePath,
				rule: 'function-name-pattern',
				message: `Function "${name}" should use camelCase.`
			}
		];
	});
}

export function hasNamedValueExport(lines: string[], name: string): boolean {
	const escaped = escapeRegExp(name);
	const patterns = [
		new RegExp(`^\\s*export\\s+(?:async\\s+)?function\\s+${escaped}\\b`),
		new RegExp(`^\\s*export\\s+const\\s+${escaped}\\b`)
	];
	return lines.some((line) => patterns.some((pattern) => pattern.test(line)));
}

function functionNames(lines: string[]): string[] {
	return lines.flatMap((line) => {
		const declared = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
		const arrow = line.match(
			/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/
		);
		return [declared?.[1], arrow?.[1]].filter((name): name is string => Boolean(name));
	});
}

function isAllowedFunctionName(file: AuditFile, name: string): boolean {
	return (
		isCamelCase(name) ||
		(httpHandlerNames.has(name) && fileName(file.relativePath) === '+server.ts') ||
		(['.jsx', '.tsx'].includes(file.extension) && isPascalCase(name))
	);
}
