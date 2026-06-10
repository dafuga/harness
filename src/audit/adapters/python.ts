import { auditFileLength } from '../commonRules';
import { auditIndentedPythonBlocks } from './blockHelpers';
import type { AuditAdapter, AuditFile } from './types';

export const pythonAdapter: AuditAdapter = {
	id: 'python',
	label: 'Python',
	profiles: ['lib'],
	extensions: ['.py'],
	optionalTools: ['ruff'],
	audit(file) {
		return [
			...auditFileLength(file.relativePath, file.lines, file.limits),
			...auditPythonClasses(file),
			...auditIndentedPythonBlocks(file.relativePath, file.lines, file.limits),
			...auditBroadException(file),
			...auditMutableDefaults(file),
			...auditScriptEntrypoint(file)
		];
	}
};

function auditBroadException(file: AuditFile) {
	if (!file.lines.some((line) => /^\s*except(\s+Exception)?\s*:/.test(line))) return [];
	return [
		{
			path: file.relativePath,
			rule: 'python-broad-exception',
			message: 'Catch specific Python exceptions.'
		}
	];
}

function auditPythonClasses(file: AuditFile) {
	return file.lines.flatMap((line, index) => {
		if (!/^\s*class\s+\w+/.test(line)) return [];
		const length = pythonBlockLength(file.lines, index);
		if (length <= file.limits.maxClassLines) return [];
		return [
			{
				path: file.relativePath,
				rule: 'small-class',
				message: `Python class near line ${index + 1} has ${length} lines. Limit is ${file.limits.maxClassLines}.`
			}
		];
	});
}

function auditMutableDefaults(file: AuditFile) {
	if (!file.lines.some((line) => /^\s*def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))/.test(line)))
		return [];
	return [
		{
			path: file.relativePath,
			rule: 'python-mutable-default',
			message: 'Avoid mutable Python default arguments.'
		}
	];
}

function auditScriptEntrypoint(file: AuditFile) {
	if (
		!file.relativePath.startsWith('scripts/') ||
		/if __name__ == ['"]__main__['"]/.test(file.contents)
	)
		return [];
	return [
		{
			path: file.relativePath,
			rule: 'python-entrypoint-guard',
			message: 'Python scripts should use a __main__ guard.'
		}
	];
}

function pythonBlockLength(lines: string[], start: number): number {
	let length = 1;
	const indent = lines[start].match(/^\s*/)?.[0].length ?? 0;
	for (const line of lines.slice(start + 1)) {
		if (line.trim() && (line.match(/^\s*/)?.[0].length ?? 0) <= indent) break;
		length += 1;
	}
	return length;
}
