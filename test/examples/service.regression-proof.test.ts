import { unit, scenario } from './service.regression-proof.fixture';
import type { Gathered } from './service.regression-proof.test.types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { environmentProfile } from '../../src/workflows/verification-evidence/record-regression/RegressionProofService';
import { focusedScreens } from '../../src/workflows/verification-evidence/record-regression/focusedScreens';

const commit = '5c0e8a7d2f41b96e3a0d8c17f4b2e9a6d1c35f80';
const otherCommit = 'a37d0c9e5b218f4d6e0a7c3b91f25d8e4c60b7a2';
const buildId = '8a4d2f7c1e96b03d5a2f8c4e7b1d90a3f6e2c85b4d7a1f09e3c6b28d5a7f41e0';
const file = 'evidence-grid-desktop.png';
const baseEnv = { CI: 'true', NODE_ENV: 'test', TZ: 'UTC' };

function gathered(revision: string, decoded: boolean): Gathered {
	const server = { buildId, revision };
	const line = {
		evidence: unit,
		kind: 'screenshot' as const,
		state: 'populated',
		viewport: 'desktop',
		file,
		mediaType: 'image/png',
		provenance: 'actual-capture' as const,
		server
	};
	const capture = {
		evidence: unit,
		kind: 'screenshot' as const,
		state: 'populated',
		viewport: 'desktop',
		status: 'passed' as const,
		path: `focused/${file}`,
		sha256: '2d8f6c1a9b07e54dc3a1f6280e97bd4ca5f3816e7b20c9d4e6a13f081c9d5b72',
		bytes: 48213,
		mediaType: 'image/png',
		capturedAt: '2026-11-14T18:42:07.311Z',
		provenance: 'actual-capture' as const,
		server
	};
	const facts = { kind: 'image' as const, width: 1280, height: 800 };
	return decoded ? { line, capture, facts } : { line, capture };
}

async function rejectionOf(action: () => Promise<unknown>): Promise<Error> {
	try {
		await action();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('Expected the action to reject');
}

function meta(symbol: string, state: string) {
	return {
		unitId: 'service.regression-proof',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function fingerprint(profile: string): string {
	return profile.slice(profile.lastIndexOf('/') + 1);
}

test('Retains the decoded screenshot for its declared unit', async () => {
	await withTempDir('regression-proof-screens-', async (directory) => {
		writeFileSync(join(directory, file), 'png-bytes');
		const result = await focusedScreens([gathered(commit, true)], directory, {
			commit,
			scenarios: [scenario()],
			knownUnits: [unit]
		});
		expect(result.captures.map((item) => item.unit)).toEqual([unit]);
		expect(result.captures[0]?.viewport).toEqual({ width: 1280, height: 800 });
		expect(result.files.map((item) => item.path)).toEqual([`focused/${file}`]);
		expect(result.files[0]?.bytes.toString()).toBe('png-bytes');
		recordExampleCases(
			meta('focusedScreens', 'retains-the-decoded-screenshot-for-its-declared-unit'),
			[
				{
					name: 'populated desktop screenshot of the tested commit is retained',
					input: { evidence: unit, state: 'populated', viewport: 'desktop', commit },
					output: {
						units: result.captures.map((item) => item.unit),
						viewport: { width: 1280, height: 800 },
						files: result.files.map((item) => item.path),
						bytes: result.files[0]?.bytes.length
					}
				}
			]
		);
	});
});

test('Returns no captures when a run inspected no screenshots', async () => {
	await withTempDir('regression-proof-empty-', async (directory) => {
		const result = await focusedScreens([], directory, { commit, scenarios: [scenario()] });
		expect(result).toEqual({ captures: [], files: [] });
		recordExampleCases(
			meta('focusedScreens', 'returns-no-captures-when-a-run-inspected-no-screenshots'),
			[{ name: 'empty gathered list retains nothing', input: { gathered: [], commit }, output: result }]
		);
	});
});

test('Rejects an actual capture served from another revision', async () => {
	await withTempDir('regression-proof-revision-', async (directory) => {
		const input = { gathered: [gathered(otherCommit, true)], commit, knownUnits: [unit] };
		const error = await rejectionOf(() =>
			focusedScreens(input.gathered, directory, {
				commit,
				scenarios: [scenario()],
				knownUnits: [unit]
			})
		);
		expect(error.name).toBe('ExpectedCliError');
		expect(error.message).toContain('different served revision');
		recordExampleCases(
			meta('focusedScreens', 'rejects-an-actual-capture-served-from-another-revision'),
			[
				{
					name: 'capture served from a37d0c9 is refused for tested commit 5c0e8a7',
					input: { revision: otherCommit, commit },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Rejects a screenshot that does not decode to an image', async () => {
	await withTempDir('regression-proof-decode-', async (directory) => {
		const error = await rejectionOf(() =>
			focusedScreens([gathered(commit, false)], directory, {
				commit,
				scenarios: [scenario()],
				knownUnits: [unit]
			})
		);
		expect(error.name).toBe('ExpectedCliError');
		expect(error.message).toContain('not a decoded screenshot');
		recordExampleCases(
			meta('focusedScreens', 'rejects-a-screenshot-that-does-not-decode-to-an-image'),
			[
				{
					name: 'screenshot without decoded media facts is refused',
					input: { file, facts: null },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Rejects a capture whose unit is not registered', async () => {
	await withTempDir('regression-proof-unit-', async (directory) => {
		const error = await rejectionOf(() =>
			focusedScreens([gathered(commit, true)], directory, {
				commit,
				scenarios: [scenario()],
				knownUnits: ['reports.component.other']
			})
		);
		expect(error.name).toBe('ExpectedCliError');
		expect(error.message).toContain('registered units at the tested commit');
		recordExampleCases(
			meta('focusedScreens', 'rejects-a-capture-whose-unit-is-not-registered'),
			[
				{
					name: 'populated capture resolving to an unregistered unit is refused',
					input: { unit, knownUnits: ['reports.component.other'] },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Fingerprints the environment without volatile variables', () => {
	const reordered = { TZ: 'UTC', PWD: '/workspace/project', NODE_ENV: 'test', HARNESS_AGENT_ID: 'bot-1', CI: 'true' };
	const changed = { ...baseEnv, TZ: 'Europe/Paris' };
	const profile = environmentProfile(baseEnv);
	expect(environmentProfile(reordered)).toBe(profile);
	expect(environmentProfile(changed)).not.toBe(profile);
	recordExampleCases(
		meta('environmentProfile', 'fingerprints-the-environment-without-volatile-variables'),
		[
			{
				name: 'volatile PWD and HARNESS_AGENT_ID do not change the fingerprint',
				input: reordered,
				output: fingerprint(environmentProfile(reordered))
			},
			{
				name: 'a changed TZ changes the fingerprint',
				input: changed,
				output: fingerprint(environmentProfile(changed))
			}
		]
	);
});
