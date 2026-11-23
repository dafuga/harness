import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ConsoleInstallService } from '../../src/cli/program/console-install-service/ConsoleInstallService';
import type { ConsoleInstallOptions } from '../../src/cli/program/console-install-service/ConsoleInstallService.types';

const sharedOptions = {
	policy: '$lib/server/historyPolicy',
	policyExport: 'historyPolicy',
	base: '/console'
};

const sveltePackage = JSON.stringify({
	name: 'console-host',
	devDependencies: { '@sveltejs/kit': '2.0.0' }
});

const svelteProject = {
	'svelte.config.js': 'export default {};\n',
	'src/routes/+page.svelte': '<h1>Console</h1>\n',
	'src/lib/server/historyPolicy.ts': 'export const historyPolicy = {};\n'
};

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

function installOptions(host: string): ConsoleInstallOptions {
	return { host, ...sharedOptions };
}

async function captureError(run: () => Promise<unknown>): Promise<Error | undefined> {
	try {
		await run();
		return undefined;
	} catch (caught) {
		return caught as Error;
	}
}

const consoleRoute = 'src/routes/console/+server.ts';

test('Installs the console routes into a SvelteKit host', async () => {
	await withTempDir('console-install-fresh-', async (host) => {
		await writeFiles(host, { ...svelteProject, 'package.json': sveltePackage });
		const result = await new ConsoleInstallService().install(installOptions(host));
		expect(result.written).toContain(consoleRoute);
		expect(result.policy).toBe('$lib/server/historyPolicy#historyPolicy');
		expect(result.kept).toEqual([]);
		expect(result.changes).toEqual([]);
		expect(result.storage).toEqual({ kind: 'bundle' });
		recordExampleCases(
			{
				unitId: 'service.console-install',
				symbol: 'ConsoleInstallService.install',
				state: 'installs-the-console-routes-into-a-sveltekit-host',
				evidence: 'examples-cases',
				file: 'installs-the-console-routes-into-a-sveltekit-host.json'
			},
			[
				{
					name: 'fresh SvelteKit host with no console files',
					input: sharedOptions,
					output: {
						policy: result.policy,
						base: result.base,
						written: result.written,
						removed: result.removed,
						kept: result.kept,
						changes: result.changes,
						data: result.data,
						storage: result.storage,
						warnings: result.warnings
					}
				}
			]
		);
	});
});

test('Refuses held content without an update or keep decision', async () => {
	await withTempDir('console-install-held-', async (host) => {
		const held = 'export const GET = () => new Response("mine");\n';
		await writeFiles(host, {
			...svelteProject,
			'package.json': sveltePackage,
			[consoleRoute]: held
		});
		const error = await captureError(() =>
			new ConsoleInstallService().install(installOptions(host))
		);
		expect(error).toBeInstanceOf(Error);
		expect(error?.name).toBe('ExpectedCliError');
		expect(await readFile(join(host, consoleRoute), 'utf8')).toBe(held);
		recordExampleCases(
			{
				unitId: 'service.console-install',
				symbol: 'ConsoleInstallService.install',
				state: 'refuses-held-content-without-an-update-or-keep-decision',
				evidence: 'examples-cases',
				file: 'refuses-held-content-without-an-update-or-keep-decision.json'
			},
			[
				{
					name: 'existing hooks file with other content and no update or keep option',
					input: sharedOptions,
					error: { name: error?.name, message: error?.message }
				}
			]
		);
	});
});

test('Restore rejects when no replaced contents are recorded', async () => {
	await withTempDir('console-restore-missing-', async (host) => {
		await writeFiles(host, { 'package.json': sveltePackage });
		const path = 'src/routes/console/+page.server.ts';
		const error = await captureError(() => new ConsoleInstallService().restore(host, path));
		expect(error).toBeInstanceOf(Error);
		expect(error?.name).toBe('ExpectedCliError');
		recordExampleCases(
			{
				unitId: 'service.console-install',
				symbol: 'ConsoleInstallService.restore',
				state: 'restore-rejects-when-no-replaced-contents-are-recorded',
				evidence: 'examples-cases',
				file: 'restore-rejects-when-no-replaced-contents-are-recorded.json'
			},
			[
				{
					name: 'path with no saved replaced contents in a host without a manifest',
					input: { path },
					error: { name: error?.name, message: error?.message }
				}
			]
		);
	});
});
