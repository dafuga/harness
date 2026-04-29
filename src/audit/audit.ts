import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { auditArchitecture } from './architectureRules';
import { auditBlocks } from './blockRules';
import { collectAuditedFiles } from './collect';
import { frameRuleLimits } from '../rules/catalog';
import type { AuditFinding } from './types';

export type { AuditFinding } from './types';

export async function auditPath(root: string): Promise<AuditFinding[]> {
	const files = await collectAuditedFiles(root);
	const findings = await Promise.all(files.map((file) => auditFile(root, file)));
	return findings.flat();
}

async function auditFile(root: string, path: string): Promise<AuditFinding[]> {
	const contents = await readFile(path, 'utf8');
	const lines = contents.split('\n');
	const structuralLines = maskTemplateLiterals(contents).split('\n');
	const displayPath = relative(root, path);

	return [
		...auditFileLength(displayPath, lines),
		...auditBlocks(displayPath, structuralLines),
		...auditArchitecture(displayPath, structuralLines)
	];
}

function auditFileLength(path: string, lines: string[]): AuditFinding[] {
	if (lines.length <= frameRuleLimits.maxFileLines) {
		return [];
	}

	return [
		{
			path,
			rule: 'small-file',
			message: `File has ${lines.length} lines. Split it by responsibility.`
		}
	];
}

function maskTemplateLiterals(contents: string): string {
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
