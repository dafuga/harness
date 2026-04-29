import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';

test('audit reports oversized files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-audit-'));
	const longFile = Array.from({ length: 225 }, (_, index) => `export const value${index} = ${index};`);

	await writeFile(join(root, 'large.ts'), longFile.join('\n'));

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-file')).toBe(true);
	await rm(root, { recursive: true, force: true });
});

test('audit reports oversized functions and ignores build folders', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-audit-'));
	const longFunction = [
		'export function tooLong(): number {',
		...Array.from({ length: 56 }, (_, index) => `\tconst value${index} = ${index};`),
		'\treturn 1;',
		'}'
	];

	await writeFile(join(root, 'large-function.ts'), longFunction.join('\n'));
	await mkdir(join(root, 'node_modules'));
	await writeFile(join(root, 'node_modules', 'ignored.ts'), longFunction.join('\n'));

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-function')).toBe(true);
	expect(findings.some((finding) => finding.path.includes('node_modules'))).toBe(false);
	await rm(root, { recursive: true, force: true });
});
