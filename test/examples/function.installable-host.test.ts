import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
	installableHost,
	hostWarnings
} from '../../src/cli/program/console-install-service/installableHost';
import type { HostRequest } from '../../src/utils/development-tooling/installableHost';

async function makeHost(directory: string, policySource: string): Promise<void> {
	await writeFile(join(directory, 'svelte.config.js'), 'export default {};');
	await mkdir(join(directory, 'src/routes'), { recursive: true });
	await mkdir(join(directory, 'src/lib/server'), { recursive: true });
	await writeFile(join(directory, 'src/lib/server/harnessPolicy.ts'), policySource);
}

test('Validates a SvelteKit host and its install policy', async () => {
	await withTempDir('installable-host-', async (host) => {
		await makeHost(host, 'export function canInstallConsole() { return true; }');
		const options = {
			host,
			policy: '$lib/server/harnessPolicy',
			policyExport: 'canInstallConsole',
			base: '/harness',
			update: true,
			keep: false,
			bucket: 'HARNESS_HISTORY',
			prefix: 'history'
		} satisfies HostRequest;
		const output = await installableHost(options);
		expect(output).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'function.installable-host',
				symbol: 'installableHost',
				state: 'validates-a-sveltekit-host-and-its-install-policy',
				evidence: 'examples-cases',
				file: 'validates-a-sveltekit-host-and-its-install-policy.json'
			},
			[
				{
					name: 'valid host has SvelteKit routes and exported policy',
					input: { ...options, host: '/workspace/my-sveltekit-app' },
					output: 'resolves'
				}
			]
		);
	});
});

test('Reports missing dependency and oversized history', async () => {
	await withTempDir('host-warnings-', async (host) => {
		await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: {} }));
		const output = await hostWarnings(host, 4718592);
		expect(output).toHaveLength(2);
		recordExampleCases(
			{
				unitId: 'function.installable-host',
				symbol: 'hostWarnings',
				state: 'reports-missing-dependency-and-oversized-history',
				evidence: 'examples-cases',
				file: 'reports-missing-dependency-and-oversized-history.json'
			},
			[
				{
					name: 'missing package dependency and 4.5 MiB history',
					input: { host: '/workspace/my-sveltekit-app', compressedBytes: 4718592 },
					output
				}
			]
		);
	});
});
