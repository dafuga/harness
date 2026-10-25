import { expect } from 'vitest';
import {
	regressionFiles,
	regressionFixCommit
} from '../../src/utils/verification-evidence/regressionFiles';
import { regressionTestCommit } from '../../src/workflows/verification-evidence/record-regression/regressionFiles';
import { regressionInputFixture, fixtureUnitPath } from './regressionInputFixture';
import type {
	FrozenFixtureInputs,
	RegressionInputExample,
	RegressionInputFixture
} from './regressionInputFixture.types';

/** Return the actual tracked-file and authored-data projection, including real Git blob identities. */
export async function invokeRegressionFiles(input: RegressionInputExample) {
	const fixture = await regressionInputFixture();
	try {
		let tests = ['test/proof.ts'];
		if (input.fixture === 'empty') tests = [];
		if (input.fixture === 'untracked') tests = ['missing.test.ts'];
		if (input.fixture === 'product') tests = ['source.ts'];
		const raw: unknown = await regressionFiles(fixture.root, fixture.red.source.commit, tests);
		const frozen: FrozenFixtureInputs = Array.isArray(raw)
			? { inputs: raw, expectations: [] }
			: (raw as FrozenFixtureInputs);
		for (const item of frozen.inputs)
			expect(item.hash).toBe(
				await fixture.git(['rev-parse', fixture.red.source.commit + ':' + item.path])
			);
		for (const item of frozen.expectations) {
			expect(item.unit).toBe('function.sample');
			expect(item.blob).toBe(
				await fixture.git(['rev-parse', fixture.red.source.commit + ':' + item.path])
			);
		}
		return {
			files: frozen.inputs.map((item) => item.path),
			expectations: frozen.expectations.map((item) => ({
				unit: item.unit,
				path: item.path,
				sha256: item.sha256
			}))
		};
	} finally {
		await fixture.close();
	}
}

export async function invokeRegressionFix(input: RegressionInputExample): Promise<void> {
	const fixture = await regressionInputFixture();
	try {
		let commit = fixture.red.source.commit;
		const changes: Record<string, string> = {};
		if (!['same', 'metadata-only'].includes(input.fixture))
			changes['source.ts'] = 'export function selectedValue(): number { return 3; }';
		if (input.fixture === 'changed-test') changes['test/proof.ts'] = 'export const selected = 2;';
		if (input.fixture === 'authored') {
			await assertAuthoredInputVariants(fixture);
			fixture.unit.testing!.examples![0].expected = { kind: 'value', value: 2 };
			changes[fixtureUnitPath] = JSON.stringify(fixture.unit);
			changes['source.ts'] = 'export function selectedValue(): number { return 2; }';
		}
		if (input.fixture === 'metadata-only')
			changes['README.md'] = 'Documentation alone is not a repair.';
		if (input.fixture === 'documentation') {
			fixture.unit.responsibility = 'Clarify the fixture without changing its authored answer.';
			changes[fixtureUnitPath] = JSON.stringify(fixture.unit);
		}
		if (Object.keys(changes).length) commit = await fixture.commit(changes);
		await regressionFixCommit(fixture.root, commit, fixture.red);
	} finally {
		await fixture.close();
	}
}

export async function invokeRegressionTestCommit(input: RegressionInputExample): Promise<void> {
	const fixture = await regressionInputFixture();
	try {
		const changes: Record<string, string> = {};
		const tests = ['test/proof.ts'];
		if (input.fixture === 'documentation-only') changes['README.md'] = 'No test changed.';
		else if (input.fixture === 'named-product-source') {
			changes['source.ts'] = 'export function selectedValue(): number { return 3; }';
			tests.push('source.ts');
		} else if (input.fixture === 'authored-only') {
			fixture.unit.testing!.examples![0].expected = { kind: 'value', value: 4 };
			changes[fixtureUnitPath] = JSON.stringify(fixture.unit);
		} else if (input.fixture === 'product')
			changes['source.ts'] = 'export function selectedValue(): number { return 3; }';
		else if (input.fixture === 'named-product-metadata') {
			fixture.unit.responsibility = 'Hide a product contract change among named tests.';
			changes[fixtureUnitPath] = JSON.stringify(fixture.unit);
			tests.push(fixtureUnitPath);
		} else changes['test/proof.ts'] = 'export const selected = 4;';
		const commit = await fixture.commit(changes);
		await regressionTestCommit(fixture.root, commit, tests);
	} finally {
		await fixture.close();
	}
}

/** The same authored-answer case also retains its case identity and contract Example inputs. */
async function assertAuthoredInputVariants(fixture: RegressionInputFixture): Promise<void> {
	for (const variant of ['case-identity', 'contract-example']) {
		const unit = globalThis.structuredClone(fixture.unit);
		if (variant === 'case-identity') unit.testing!.cases[0].id = 'renamed';
		else unit.contract.outputs[0].examples = [2];
		const commit = await fixture.commit({
			'source.ts': 'export function selectedValue(): number { return 3; }',
			[fixtureUnitPath]: JSON.stringify(unit)
		});
		await expect(
			regressionFixCommit(fixture.root, commit, fixture.red),
			'Authored case identities and example comments must remain unchanged'
		).rejects.toThrow('authored regression expectations');
	}
}
