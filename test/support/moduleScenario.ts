import { expect } from 'vitest';
import { join } from 'node:path';
import { runCommand, runHarness } from './cli';
import { sqliteRuntimePackage } from './sqliteRuntimePackage';

/** Standard module scenario: add, generate, reinstall, compile and exercise emitted code. */
export async function assertModuleProject(root: string): Promise<void> {
	await runHarness(['new', 'app', 'module-app'], root);
	const project = join(root, 'module-app');
	await sqliteRuntimePackage(project);
	await runHarness(['module', 'add', 'email'], project);
	await runHarness(['module', 'add', 'offline'], project);
	await runHarness(['module', 'generate', 'email', 'email', 'Welcome'], project);
	await runHarness(['module', 'generate', 'offline', 'collection', 'Notes'], project);
	const catalog = await runHarness(['module', 'list', '--json'], project);
	expect(
		JSON.parse(catalog.stdout).modules.filter((entry: { installed: boolean }) => entry.installed)
	).toHaveLength(2);
	const repeated = await runHarness(['module', 'add', 'email'], project);
	expect(repeated.stdout).toContain('already installed');
	await runCommand(['bun', 'install'], project);
	await runCommand(['bun', 'run', 'format'], project);
	const check = await runCommand(['bun', 'run', 'check'], project);
	expect(check.stdout + check.stderr).toContain('Harness audit passed');
}
