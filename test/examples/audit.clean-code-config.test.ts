import { test } from 'vitest';
import {
	cleanCodeDefaults,
	resolveCleanCodeSettings
} from '../../src/audit/development-tooling/cleanCodeConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type ResolveOptions = Parameters<typeof resolveCleanCodeSettings>[1];
type Cases = Parameters<typeof recordExampleCases>[1];

const configured = {
	mode: 'advisory',
	minConfidence: 0.9,
	apiKeyEnv: 'CI_JEV_API_KEY',
	model: 'jev-1.13.0',
	exclude: ['src/generated']
};

function record(state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'audit.clean-code-config',
			symbol: 'resolveCleanCodeSettings',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function rejected(raw: unknown, options?: ResolveOptions): { name: string; message: string } {
	let error: unknown;
	try {
		resolveCleanCodeSettings(raw, options);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	expect(actual.name).toBe('ExpectedCliError');
	return { name: actual.name, message: actual.message };
}

test('Resolves default and configured clean-code settings', () => {
	const defaults = resolveCleanCodeSettings({});
	expect(defaults).toEqual(cleanCodeDefaults);
	const custom = resolveCleanCodeSettings(configured);
	expect(custom).toEqual(configured);

	record('resolves-default-and-configured-clean-code-settings', [
		{ name: 'empty config uses the defaults', input: {}, output: defaults },
		{ name: 'configured values are kept', input: configured, output: custom }
	]);
});

test('Applies CLI overrides to the clean-code mode', () => {
	const enabledInput = { raw: {}, options: { enabled: true } };
	const enabled = resolveCleanCodeSettings(enabledInput.raw, enabledInput.options);
	expect(enabled.mode).toBe('advisory');
	const gateInput = { raw: { mode: 'advisory' }, options: { gate: true, dryRun: true } };
	const gated = resolveCleanCodeSettings(gateInput.raw, gateInput.options);
	expect(gated.mode).toBe('gate');
	const dryRunInput = { raw: {}, options: { dryRun: true } };
	const dryRunError = rejected(dryRunInput.raw, dryRunInput.options);
	expect(dryRunError.message).toBe(
		'Invalid harness.audit.json cleanCode.mode: enable review with --clean-code.'
	);

	record('applies-cli-overrides-to-the-clean-code-mode', [
		{ name: 'enabled upgrades off to advisory', input: enabledInput, output: enabled },
		{ name: 'gate forces gate mode', input: gateInput, output: gated },
		{ name: 'dry run with mode off is rejected', input: dryRunInput, error: dryRunError }
	]);
});

test('Rejects malformed clean-code configuration', () => {
	const inputs = [null, { mode: 'auto' }, { minConfidence: 1.5 }, { exclude: ['  '] }];
	const cases: Cases = inputs.map((raw) => ({
		name: `rejects ${JSON.stringify(raw)}`,
		input: raw,
		error: rejected(raw)
	}));
	expect(cases.map((item) => (item as { error: { message: string } }).error.message)).toEqual([
		'Invalid harness.audit.json cleanCode.configuration.',
		'Invalid harness.audit.json cleanCode.mode.',
		'Invalid harness.audit.json cleanCode.minConfidence.',
		'Invalid harness.audit.json cleanCode.exclude.'
	]);

	record('rejects-malformed-clean-code-configuration', cases);
});
