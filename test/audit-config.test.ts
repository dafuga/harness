import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';

test('audit config overrides file limits while preserving function defaults', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-config-'));
	try {
		await writeConfig(root, { maxFileLines: 300 });
		await writeFile(
			join(root, 'large.ts'),
			Array.from({ length: 225 }, () => 'export {};').join('\n')
		);
		await writeFile(join(root, 'large-function.ts'), longFunctionFixture());

		const rules = (await auditPath(root)).map((finding) => finding.rule);

		expect(rules).not.toContain('small-file');
		expect(rules).toContain('small-function');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('audit config overrides method limits', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-method-config-'));
	try {
		await writeConfig(root, { maxMethodLines: 40 });
		await writeFile(join(root, 'large-method.ts'), bigMethodFixture());

		const rules = (await auditPath(root)).map((finding) => finding.rule);

		expect(rules).not.toContain('method-length');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function writeConfig(root: string, limits: Record<string, number>): Promise<void> {
	await writeFile(join(root, 'harness.audit.json'), JSON.stringify({ limits, ignore: [] }));
}

function longFunctionFixture(): string {
	return `${[
		'export function tooLong(): void {',
		...Array.from({ length: 56 }, () => '\tvoid 1;'),
		'}'
	].join('\n')}\n`;
}

function bigMethodFixture(): string {
	return `${[
		'export class BigMethod {',
		'\trun(): void {',
		...Array.from({ length: 36 }, () => '\t\tvoid 1;'),
		'\t}',
		'}'
	].join('\n')}\n`;
}
