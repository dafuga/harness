import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { previewArguments } from '../../src/utils/development-tooling/previewArguments';
import type { PreviewArguments, PreviewOptions } from '../../src/utils/development-tooling/previewArguments.types';

test('Preview options resolve checkout and hash settings', () => {
	const root = mkdtempSync(join(tmpdir(), 'preview-arguments-'));
	try {
		const env = {
			HARNESS_CONSOLE_DATA: '/tmp/harness-history',
			BODY_SIZE_LIMIT: '10485760',
			PATH: '/usr/local/bin:/usr/bin:/bin'
		};
		const launchTokens = [root, '--strictPort', '--port', '5688', '--config', '/tmp/vite.config.ts'];
		const actual: PreviewArguments = previewArguments(launchTokens, env);
		const otherPort: PreviewArguments = previewArguments(
			[root, '--port', '5689', '--config', '/tmp/vite.config.ts'],
			{ ...env, PATH: '/different/path' }
		);
		const options: PreviewOptions = {
			root: actual.root,
			configFile: actual.configFile,
			port: actual.port
		};
		const result = {
			root: actual.root,
			configFile: actual.configFile,
			port: actual.port,
			identity: actual.identity
		};
		expect(options).toEqual({ root: realpathSync(root), configFile: '/tmp/vite.config.ts', port: 5688 });
		expect(actual.identity).toMatch(/^[a-f0-9]{64}$/);
		expect(actual.identity).toBe(otherPort.identity);
		recordExampleCases(
			{
				unitId: 'reports.function.preview-arguments',
				symbol: 'previewArguments',
				state: 'preview-options-resolve-checkout-and-hash-settings',
				evidence: 'examples-cases',
				file: 'preview-options-resolve-checkout-and-hash-settings.json'
			},
			[
				{
					name: 'launch config keeps the real root while ignored path and port changes preserve identity',
					input: { args: launchTokens, env },
					output: {
						...result,
						identityExcludesPort: actual.identity === otherPort.identity
					}
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws Error when an option value is missing', () => {
	const root = mkdtempSync(join(tmpdir(), 'preview-arguments-'));
	const args = [root, '--config'];
	try {
		expect(() => previewArguments(args, {})).toThrow('Missing value for --config.');
		recordExampleCases(
			{
				unitId: 'reports.function.preview-arguments',
				symbol: 'previewArguments',
				state: 'throws-error-when-an-option-value-is-missing',
				evidence: 'examples-cases',
				file: 'throws-error-when-an-option-value-is-missing.json'
			},
			[
				{
					name: 'config option has no following token',
					input: { args, env: {} },
					error: 'Missing value for --config.'
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
