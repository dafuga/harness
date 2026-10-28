import { expect } from 'vitest';
import process from 'node:process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit } from '../../scripts/harness-audit';
import unit from '../../specification/units/script.harness-audit.json';

export function checkAuditExample(index: number): void {
	const example = unit.testing.examples[index];
	if (example.expected.kind === 'value')
		expect(withAuditFixture(example.input[0], runAudit)).toEqual(example.expected.value);
	else {
		if (typeof example.expected.value !== 'object' || example.expected.value === null)
			throw new TypeError('An error Example must declare its error fields.');
		let caught: unknown;
		try {
			withAuditFixture(example.input[0], runAudit);
		} catch (error) {
			caught = error;
		}
		expect(caught).toMatchObject(example.expected.value);
	}
}

/** Uses disposable source, never the developer's project files or credential stores. */
export function withAuditFixture(mode: string, audit: () => number): number {
	const root = mkdtempSync(join(tmpdir(), 'harness-audit-example-'));
	const before = { cwd: process.cwd(), cli: process.env.HARNESS_CLI_PATH, path: process.env.PATH };
	try {
		mkdirSync(join(root, 'src'));
		writeFileSync(join(root, 'src/index.ts'), 'export const greeting = "Hello";\n');
		writeFileSync(
			join(root, 'package.json'),
			JSON.stringify({ type: 'module', harness: { kind: 'lib' } })
		);
		writeFileSync(join(root, 'harness.audit.json'), JSON.stringify({ cleanCode: { mode: 'off' } }));
		process.chdir(root);
		if (mode === 'invalid-source') {
			expect(audit(), 'the identical clean source must pass before the violation').toBe(0);
			writeFileSync(join(root, 'src/index.ts'), '// oversized source\n'.repeat(221));
		}
		if (mode === 'missing-cli') process.env.HARNESS_CLI_PATH = join(root, 'missing-cli.ts');
		if (mode === 'missing-command') {
			delete process.env.HARNESS_CLI_PATH;
			process.env.PATH = root;
		}
		return audit();
	} finally {
		process.chdir(before.cwd);
		if (before.cli === undefined) delete process.env.HARNESS_CLI_PATH;
		else process.env.HARNESS_CLI_PATH = before.cli;
		if (before.path === undefined) delete process.env.PATH;
		else process.env.PATH = before.path;
		rmSync(root, { recursive: true, force: true });
	}
}
