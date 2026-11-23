import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import type { ResourceConfig } from '../../src/core/execution-runtimes/resourceTypes';
import {
	resourceConfig,
	resourceHome,
	saveResourceConfig
} from '../../src/utils/execution-runtimes/resourceConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const defaults: ResourceConfig = {
	schemaVersion: 1,
	cpuReservePercent: 10,
	memoryReservePercent: 10,
	minMemoryReserveMiB: 2048,
	pollMs: 1000,
	staleSampleMs: 5000
};

const tuned: ResourceConfig = {
	schemaVersion: 1,
	cpuReservePercent: 25,
	memoryReservePercent: 20,
	minMemoryReserveMiB: 4096,
	pollMs: 500,
	staleSampleMs: 10000
};

const tight: ResourceConfig = {
	schemaVersion: 1,
	cpuReservePercent: 30,
	memoryReservePercent: 15,
	minMemoryReserveMiB: 8192,
	pollMs: 250,
	staleSampleMs: 2000
};

function meta(symbol: string, state: string) {
	return {
		unitId: 'function.resource-config',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function thrownName(action: () => unknown): string {
	try {
		action();
		return 'none';
	} catch (error) {
		return error instanceof Error ? error.name : 'unknown';
	}
}

test('Resolves the resource home from HARNESS_RESOURCES_HOME', () => {
	const env = {
		HARNESS_RESOURCES_HOME: '/srv/harness/resources',
		PATH: '/usr/local/bin:/usr/bin:/bin'
	};
	const projectEnv = { HARNESS_RESOURCES_HOME: '/workspace/project/shared/harness' };
	const explicit = resourceHome(env);
	const shared = resourceHome(projectEnv);

	expect(explicit).toBe('/srv/harness/resources');
	expect(shared).toBe('/workspace/project/shared/harness');
	recordExampleCases(
		meta('resourceHome', 'resolves-the-resource-home-from-harness-resources-home'),
		[
			{ name: 'absolute HARNESS_RESOURCES_HOME is kept', input: env, output: explicit },
			{ name: 'project-scoped shared directory', input: projectEnv, output: shared }
		]
	);
});

test('Returns schema defaults when config.json is absent', async () => {
	await withTempDir('resource-config-empty-', (root) => {
		const home = join(root, 'absent');
		const config = resourceConfig(home);

		expect(config).toEqual(defaults);
		expect(existsSync(home)).toBe(false);
		recordExampleCases(
			meta('resourceConfig', 'returns-schema-defaults-when-config-json-is-absent'),
			[{ name: 'directory without config.json', input: { configJson: 'absent' }, output: config }]
		);
	});
});

test('Saves a validated config and reads it back', async () => {
	await withTempDir('resource-config-save-', (root) => {
		const home = join(root, 'harness', 'resources');
		saveResourceConfig(tuned, home);
		const first = resourceConfig(home);
		saveResourceConfig(tight, home);
		const second = resourceConfig(home);

		expect(first).toEqual(tuned);
		expect(second).toEqual(tight);
		recordExampleCases(meta('saveResourceConfig', 'saves-a-validated-config-and-reads-it-back'), [
			{ name: 'first save persists the tuned reserves', input: tuned, output: first },
			{ name: 'second save replaces config.json', input: tight, output: second }
		]);
	});
});

test('Rejects invalid settings without writing a file', async () => {
	await withTempDir('resource-config-reject-', (root) => {
		const home = join(root, 'resources');
		const lowCpu = { ...defaults, cpuReservePercent: 5 };
		const unknownKey = { ...defaults, extraKey: true };
		const lowName = thrownName(() => saveResourceConfig(lowCpu, home));
		const unknownName = thrownName(() => saveResourceConfig(unknownKey, home));

		expect(lowName).toBe('ZodError');
		expect(unknownName).toBe('ZodError');
		expect(existsSync(home)).toBe(false);
		recordExampleCases(
			meta('saveResourceConfig', 'rejects-invalid-settings-without-writing-a-file'),
			[
				{ name: 'cpuReservePercent below 10 is rejected', input: lowCpu, error: lowName },
				{ name: 'unknown key is rejected', input: unknownKey, error: unknownName }
			]
		);
	});
});

test('Throws on malformed JSON in config.json', async () => {
	await withTempDir('resource-config-json-', (home) => {
		const content = '{"cpuReservePercent": 25,';
		writeFileSync(join(home, 'config.json'), content);
		const name = thrownName(() => resourceConfig(home));

		expect(name).toBe('SyntaxError');
		recordExampleCases(meta('resourceConfig', 'throws-on-malformed-json-in-config-json'), [
			{ name: 'truncated JSON object', input: { content }, error: name }
		]);
	});
});

test('Throws on persisted values that fail the schema', async () => {
	await withTempDir('resource-config-schema-', (home) => {
		const content = JSON.stringify({ ...defaults, cpuReservePercent: 5 });
		writeFileSync(join(home, 'config.json'), content);
		const name = thrownName(() => resourceConfig(home));

		expect(name).toBe('ZodError');
		recordExampleCases(meta('resourceConfig', 'throws-on-persisted-values-that-fail-the-schema'), [
			{ name: 'cpuReservePercent outside its range', input: { content }, error: name }
		]);
	});
});
