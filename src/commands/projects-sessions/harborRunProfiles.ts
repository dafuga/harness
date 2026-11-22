// @harness-uid u_yga4vj5ueo
import { extname, isAbsolute, resolve } from 'node:path';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { RunMode, RunProfile } from './HarborInspectionCommand.types';

const RUNTIME_ENV = [
	'PATH',
	'HOME',
	'USERPROFILE',
	'SystemRoot',
	'APPDATA',
	'LOCALAPPDATA',
	'TMPDIR',
	'TMP',
	'TEMP',
	'LANG',
	'LC_ALL',
	'HARBOR_HOME'
];

// SDK-backed modes run the installed Harbor App SDK; scaffold gets extra time for its nested Harness call.
export const HARBOR_RUN_PROFILES: Record<RunMode, RunProfile> = {
	inspect: {
		sdk: false,
		timeoutMs: 3000,
		failure: 'The installed Harbor CLI reported an inspection error.',
		stopped: 'Could not inspect Harbor through its installed CLI.'
	},
	publish: {
		sdk: true,
		timeoutMs: 780_000,
		failure:
			'Harbor could not complete publication. Check the testnet profile and local verification record.',
		stopped: 'Harbor publication stopped.'
	},
	tool: {
		sdk: true,
		timeoutMs: 120_000,
		failure: 'The installed Harbor SDK reported an app tooling error.',
		stopped: 'Could not run Harbor app tooling through its installed SDK.'
	},
	scaffold: {
		sdk: true,
		timeoutMs: 150_000,
		failure: 'The installed Harbor SDK could not scaffold the app.',
		stopped: 'Harbor app scaffolding stopped.'
	}
};

export function installedEntry(sdk: boolean): string {
	const variable = sdk ? 'HARNESS_HARBOR_APP_SDK_PATH' : 'HARNESS_HARBOR_CLI_PATH';
	const entry = process.env[variable];
	if (!entry || !isAbsolute(entry) || !['.js', '.cjs', '.mjs'].includes(extname(entry))) {
		throw new ExpectedCliError(`Set ${variable} to the installed Harbor package entry.`);
	}
	return entry;
}

export function nodeExecutable(): string {
	const node = unsetIfEmpty(process.env.HARNESS_HARBOR_NODE_PATH) ?? Bun.which('node');
	if (!node || !isAbsolute(node) || /\.(?:bat|cmd)$/i.test(node)) {
		throw new ExpectedCliError('Set HARNESS_HARBOR_NODE_PATH to an absolute Node executable.');
	}
	return node;
}

export function runtimeEnv(mode: RunMode, node: string): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = Object.fromEntries(
		RUNTIME_ENV.map((key) => [key, process.env[key]])
	);
	if (mode === 'inspect') return env;
	const sdkEnv = { ...env, HARNESS_CLI_PATH: resolve(process.argv[1]) };
	if (mode !== 'publish') return sdkEnv;
	return {
		...sdkEnv,
		HARNESS_HARBOR_CLI_PATH: process.env.HARNESS_HARBOR_CLI_PATH,
		HARNESS_HARBOR_NODE_PATH: node
	};
}

// Empty values count as unset, matching the earlier `||` fallback.
export function unsetIfEmpty(value: string | undefined): string | undefined {
	return value === '' ? undefined : value;
}
