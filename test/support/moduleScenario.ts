import { assertRustModuleProject } from './rustModuleScenario';
import { expect } from 'vitest';
import { join } from 'node:path';
import { runCommand, runHarness } from './cli';
import { sqliteRuntimePackage } from './sqliteRuntimePackage';
import {
	prepareBrowserBaselineReport,
	expectMissingScreenshotResults
} from './browserBaselineResults';

/** Standard module scenario: add, generate, reinstall, compile and exercise emitted code. */
export async function assertModuleProject(root: string): Promise<void> {
	await runHarness(['new', 'app', 'module-app'], root);
	const project = join(root, 'module-app');
	await sqliteRuntimePackage(project);
	await runHarness(['module', 'add', 'email'], project);
	await runHarness(['module', 'add', 'offline'], project);
	await runHarness(['module', 'generate', 'email', 'email', 'Welcome'], project);
	await runHarness(['module', 'generate', 'offline', 'collection', 'Notes'], project);
	await runHarness(
		['module', 'generate', 'services', 'service', 'Invoice', '--group', 'billing'],
		project
	);
	await runHarness(['module', 'generate', 'types', 'type', 'Invoice'], project);
	await runHarness(['module', 'generate', 'styles', 'style', 'Invoice'], project);
	const catalog = await runHarness(['module', 'list', '--json'], project);
	expect(
		JSON.parse(catalog.stdout).modules.filter((entry: { installed: boolean }) => entry.installed)
	).toHaveLength(14);
	const repeated = await runHarness(['module', 'add', 'email'], project);
	expect(repeated.stdout).toContain('already installed');
	await assertRustModuleProject(project);
	await runCommand(['bun', 'install'], project);
	await prepareBrowserBaselineReport(project);
	await runCommand(['bun', 'run', 'format'], project);
	const check = await runCommand(['bun', 'run', 'check'], project, false);
	const output = check.stdout + check.stderr;
	expect(check.exitCode).toBe(1);
	expect(output).toContain('svelte-check found 0 errors');
	expect(output).toContain('Harness audit passed');
	await expectMissingScreenshotResults(project, output, 3);
	await runCommand(['bun', 'run', 'build'], project);
}
