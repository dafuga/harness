import { measureWorkload } from './measureWorkload';
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
	await runHarness(['info', 'modules'], project);
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
	).toHaveLength(15);
	const repeated = await runHarness(['module', 'add', 'email'], project);
	expect(repeated.stdout).toContain('already installed');
	await assertRustModuleProject(project);
	await runCommand(['bun', 'install'], project);
	await assertTestingPlugins(project);
	await prepareBrowserBaselineReport(project);
	await runCommand(['bun', 'run', 'format'], project);
	const check = await runCommand(['bun', 'run', 'check'], project, false);
	const output = check.stdout + check.stderr;
	expect(check.exitCode).toBe(1);
	expect(output).toContain('svelte-check found 0 errors');
	expect(output).toContain('Harness audit passed');
	// The normal suite includes three app viewports and the two generated plugin tests.
	await expectMissingScreenshotResults(project, output, 5);
	await runCommand(['bun', 'run', 'build'], project);
}

async function assertTestingPlugins(project: string): Promise<void> {
	await measureWorkload(
		'template.module-system-testing-plugins',
		'generate-browser-plugin-test',
		() => runHarness(['plugin', 'generate', 'playwright', 'test', 'Smoke'], project)
	);
	await measureWorkload('template.module-system-audio-testing-files', 'install-audio-plugin', () =>
		runHarness(['plugin', 'add', 'headless-audio'], project)
	);
	await runHarness(['plugin', 'generate', 'headless-audio', 'test', 'Playback'], project);
	await runCommand(['bun', 'install'], project);
	await runCommand(['bun', 'x', 'playwright', 'install', 'chromium'], project);
	const plugins = JSON.parse((await runHarness(['plugin', 'list', '--json'], project)).stdout);
	expect(plugins.modules).toHaveLength(6);
	expect(
		plugins.modules.some(
			(entry: { definition: { id: string } }) => entry.definition.id === 'services'
		)
	).toBe(false);
	await measureWorkload(
		'template.module-system-browser-testing-files',
		'run-default-headless-browser',
		() => runHarness(['plugin', 'test', 'playwright'], project)
	);
	await measureWorkload('service.module-system-testing-plugin', 'run-headless-audio-plugin', () =>
		runHarness(['plugin', 'test', 'headless-audio'], project)
	);
}
