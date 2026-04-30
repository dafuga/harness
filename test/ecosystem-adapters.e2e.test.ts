import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { commandOutput, runCommand, runHarness } from './support/cli';

test('generated app audit rejects TypeScript, Svelte, and SQL rule violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-app-adapters-'));
	try {
		await runHarness(['new', 'app', 'adapter-app'], root);
		const project = join(root, 'adapter-app');
		await writeAppViolations(project);
		await runCommand(['bun', 'install'], project);

		const auditFailure = await runCommand(['bun', 'run', 'audit'], project, false);
		expect(auditFailure.exitCode).toBe(1);
		expectRules(commandOutput(auditFailure), [
			'svelte-script-lang',
			'svelte-component-name',
			'sql-dangerous-migration'
		]);

		const verifyFailure = await runCommand(['bun', 'run', 'verify'], project, false);
		expect(verifyFailure.exitCode).toBe(1);
		expect(commandOutput(verifyFailure)).toContain('svelte-script-lang');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

test('generated lib audit rejects C++, Python, shell, and WASM rule violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-lib-adapters-'));
	try {
		await runHarness(['new', 'lib', 'adapter-lib'], root);
		const project = join(root, 'adapter-lib');
		await writeLibViolations(project);
		await runCommand(['bun', 'install'], project);

		const auditFailure = await runCommand(['bun', 'run', 'audit'], project, false);
		expect(auditFailure.exitCode).toBe(1);
		expectRules(commandOutput(auditFailure), [
			'cpp-header-namespace',
			'python-mutable-default',
			'shell-strict-mode',
			'wasm-artifact-placement'
		]);

		const verifyFailure = await runCommand(['bun', 'run', 'verify'], project, false);
		expect(verifyFailure.exitCode).toBe(1);
		expect(commandOutput(verifyFailure)).toContain('wasm-artifact-placement');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

function expectRules(output: string, rules: string[]): void {
	for (const rule of rules) {
		expect(output, rule).toContain(rule);
	}
}

async function writeAppViolations(project: string): Promise<void> {
	await mkdir(join(project, 'src/components'), { recursive: true });
	await mkdir(join(project, 'db/migrations'), { recursive: true });
	await writeFile(
		join(project, 'src/components/bad-name.svelte'),
		'<script>let label = "Bad";</script>\n<h1>{label}</h1>\n'
	);
	await writeFile(join(project, 'db/migrations/drop_users.sql'), 'DROP TABLE users;\n');
}

async function writeLibViolations(project: string): Promise<void> {
	await mkdir(join(project, 'src/native'), { recursive: true });
	await mkdir(join(project, 'scripts'), { recursive: true });
	await writeFile(join(project, 'src/native/bad.hpp'), 'using namespace std;\n');
	await writeFile(join(project, 'scripts/run.py'), 'def bad(items=[]):\n    return items\n');
	await writeFile(join(project, 'scripts/run.sh'), '#!/bin/sh\necho $TARGET\n');
	await writeFile(join(project, 'src/module.wasm'), 'not really wasm\n');
}
