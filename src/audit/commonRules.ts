import { harnessRuleLimits } from '../rules/catalog';
import type { AuditFinding } from './types';

export function splitLines(contents: string): string[] {
	return contents.split('\n');
}

export function auditFileLength(path: string, lines: string[]): AuditFinding[] {
	if (lines.length <= harnessRuleLimits.maxFileLines) return [];
	return [
		{
			path,
			rule: 'small-file',
			message: `File has ${lines.length} lines. Split it by responsibility.`
		}
	];
}

export function auditClassCount(path: string, lines: string[]): AuditFinding[] {
	const count = lines.filter((line) => /^\s*(export\s+)?class\s+\w+/.test(line)).length;
	if (count <= harnessRuleLimits.maxClassesPerFile) return [];

	return [
		{
			path,
			rule: 'max-classes-per-file',
			message: `File defines ${count} classes. Limit is ${harnessRuleLimits.maxClassesPerFile}.`
		}
	];
}

export function maskTemplateLiterals(contents: string): string {
	let masked = '';
	let inTemplate = false;
	let escaped = false;

	for (const char of contents) {
		if (!inTemplate) {
			masked += char;
			inTemplate = char === '`';
			continue;
		}

		if (char === '\n') {
			masked += char;
			escaped = false;
			continue;
		}

		const closesTemplate = char === '`' && !escaped;
		masked += closesTemplate ? char : ' ';
		inTemplate = !closesTemplate;
		escaped = char === '\\' && !escaped;
	}

	return masked;
}
