import { test } from 'vitest';
import { pickerPaths } from '../../src/cli/program/codex-picker-command/pickerPaths';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type PickerEnv = { CODEX_HOME?: string; HARNESS_PICKER_HOME?: string };

function clearPickerEnv() {
	delete process.env.CODEX_HOME;
	delete process.env.HARNESS_PICKER_HOME;
}

function resolveWith(env: PickerEnv) {
	clearPickerEnv();
	if (env.CODEX_HOME !== undefined) process.env.CODEX_HOME = env.CODEX_HOME;
	if (env.HARNESS_PICKER_HOME !== undefined) {
		process.env.HARNESS_PICKER_HOME = env.HARNESS_PICKER_HOME;
	}
	try {
		return pickerPaths();
	} finally {
		clearPickerEnv();
	}
}

function catalogsUnder(root: string) {
	return {
		openai: `${root}/models_cache.json`,
		claude: `${root}/harness-gateway/claude-models.json`
	};
}

test('Derives picker home and catalogs from CODEX_HOME', () => {
	const input = { CODEX_HOME: '/workspace/codex-root' };
	const output = resolveWith(input);

	expect(output).toEqual({
		home: '/workspace/codex-root/harness/picker',
		catalogs: catalogsUnder('/workspace/codex-root')
	});
	recordExampleCases(
		{
			unitId: 'function.picker-paths',
			symbol: 'pickerPaths',
			state: 'derives-picker-home-and-catalogs-from-codex-home',
			evidence: 'examples-cases',
			file: 'derives-picker-home-and-catalogs-from-codex-home.json'
		},
		[{ name: 'CODEX_HOME is set to an absolute root', input, output }]
	);
});

test('Prefers HARNESS_PICKER_HOME over the Codex root', () => {
	const input = {
		CODEX_HOME: '/workspace/codex-root',
		HARNESS_PICKER_HOME: '/var/lib/harness/picker'
	};
	const output = resolveWith(input);

	expect(output).toEqual({
		home: '/var/lib/harness/picker',
		catalogs: catalogsUnder('/workspace/codex-root')
	});
	recordExampleCases(
		{
			unitId: 'function.picker-paths',
			symbol: 'pickerPaths',
			state: 'prefers-harness-picker-home-over-the-codex-root',
			evidence: 'examples-cases',
			file: 'prefers-harness-picker-home-over-the-codex-root.json'
		},
		[{ name: 'HARNESS_PICKER_HOME overrides the picker home', input, output }]
	);
});

test('Keeps an empty HARNESS_PICKER_HOME as the picker home', () => {
	const input = { CODEX_HOME: '/srv/codex-state', HARNESS_PICKER_HOME: '' };
	const output = resolveWith(input);

	expect(output).toEqual({
		home: '',
		catalogs: catalogsUnder('/srv/codex-state')
	});
	recordExampleCases(
		{
			unitId: 'function.picker-paths',
			symbol: 'pickerPaths',
			state: 'keeps-an-empty-harness-picker-home-as-the-picker-home',
			evidence: 'examples-cases',
			file: 'keeps-an-empty-harness-picker-home-as-the-picker-home.json'
		},
		[{ name: 'HARNESS_PICKER_HOME is set but empty', input, output }]
	);
});

test('Resolves an empty CODEX_HOME to a relative root', () => {
	const input = { CODEX_HOME: '' };
	const output = resolveWith(input);

	expect(output).toEqual({
		home: 'harness/picker',
		catalogs: {
			openai: 'models_cache.json',
			claude: 'harness-gateway/claude-models.json'
		}
	});
	recordExampleCases(
		{
			unitId: 'function.picker-paths',
			symbol: 'pickerPaths',
			state: 'resolves-an-empty-codex-home-to-a-relative-root',
			evidence: 'examples-cases',
			file: 'resolves-an-empty-codex-home-to-a-relative-root.json'
		},
		[{ name: 'CODEX_HOME is set but empty', input, output }]
	);
});
