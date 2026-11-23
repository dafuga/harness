import type { Manifest, Result } from './validator.component-manifest.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ComponentManifestValidator } from '../../src/validators/development-tooling/ComponentManifestValidator';
import {
	contractFindings,
	contractFailureCounts
} from '../../src/validators/development-tooling/contractFindings';

const ID = 'validator.component-manifest';
const FILE = `${ID}.json`;
const ENTRY = 'src/validators/development-tooling/ComponentManifestValidator.ts';
const validator = new ComponentManifestValidator();

const base = {
	schemaVersion: 1,
	id: ID,
	uid: 'u_amgyfn4sxl',
	kind: 'validator',
	title: 'ComponentManifestValidator',
	responsibility: 'Checks one stored unit manifest against the schema and its own file name.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: {
		source: [ENTRY],
		symbols: ['ComponentManifestValidator', 'wellFormed', 'schemaErrors']
	},
	contract: {
		origin: 'declared',
		inputs: [{ name: 'ComponentManifestValidator.validate.file', type: 'string', required: true }],
		outputs: [{ name: 'wellFormed', type: 'boolean' }],
		errors: [],
		errorStatus: 'none-found'
	},
	dependencies: [
		{ unit: 'function.derived-responsibility', via: 'import', origin: 'derived' },
		{ unit: 'function.unit-types', via: 'import', origin: 'derived' }
	],
	runtime: { kind: 'module', entry: ENTRY, targets: [{ kind: 'module', entry: ENTRY }] },
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

const unknownState = { name: 'EvidenceGrid.state', type: 'unknown', required: true };
const emptyProps = { name: 'EvidenceGrid.props', type: '{ }', required: true };
const bareError = { name: 'Error', type: 'Error', required: true };

function unitWith(id: string, inputs: unknown[], errors: unknown[] = []) {
	return { ...base, id, contract: { ...base.contract, inputs, errors } };
}

/** Builds a typed manifest from a raw fixture; contract checks are left to the test. */
function manifestOf(id: string, inputs: unknown[], errors: unknown[] = []): Manifest {
	const result = validator.validate(unitWith(id, inputs, errors), `${id}.json`, {
		contractQuality: false
	});
	if (!result.value) throw new Error(`Fixture ${id} does not parse`);
	return result.value;
}

function summary(result: Result) {
	return { hasValue: result.value !== undefined, errors: result.errors };
}

function meta(title: string, symbol: string) {
	const state = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return { unitId: ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Accepts a well-formed manifest', () => {
	const plain = validator.validate(base, FILE);
	const skipped = validator.validate(base, FILE, { contractQuality: false });
	expect(plain.errors).toEqual([]);
	expect(skipped.errors).toEqual([]);
	expect(plain.value?.id).toBe(ID);

	recordExampleCases(meta('Accepts a well-formed manifest', 'validate'), [
		{ name: 'default options', input: { id: ID, file: FILE }, output: summary(plain) },
		{
			name: 'contractQuality false',
			input: { id: ID, file: FILE, options: { contractQuality: false } },
			output: summary(skipped)
		}
	]);
});

test('Keeps the value when only field contents are wrong', () => {
	const result = validator.validate({ ...base, title: '' }, FILE);
	expect(result.value?.title).toBe('');
	expect(result.errors.length).toBeGreaterThan(0);
	expect(result.errors[0]).toMatch(/^validator\.component-manifest: title /);

	recordExampleCases(meta('Keeps the value when only field contents are wrong', 'validate'), [
		{ name: 'empty title', input: { title: '' }, output: summary(result) }
	]);
});

test('Rejects a missing id with schema messages only', () => {
	const result = validator.validate({ ...base, id: undefined }, FILE);
	expect(result.value).toBeUndefined();
	expect(result.errors.length).toBeGreaterThan(0);
	expect(result.errors[0]).toMatch(/^validator\.component-manifest: id /);

	recordExampleCases(meta('Rejects a missing id with schema messages only', 'validate'), [
		{ name: 'id field removed', input: { id: 'missing' }, output: summary(result) }
	]);
});

test('Flags an id that differs from its file name', () => {
	const elsewhere = validator.validate(base, 'reports.component.evidence-grid.json');
	const nested = validator.validate(base, `src/units/${FILE}`);
	expect(elsewhere.errors).toEqual([
		'reports.component.evidence-grid: id "validator.component-manifest" must match its file name'
	]);
	expect(nested.errors).toEqual([]);

	recordExampleCases(meta('Flags an id that differs from its file name', 'validate'), [
		{
			name: 'file is another unit',
			input: { id: ID, file: 'reports.component.evidence-grid.json' },
			output: summary(elsewhere)
		},
		{
			name: 'nested path with same id',
			input: { id: ID, file: `src/units/${FILE}` },
			output: summary(nested)
		}
	]);
});

test('Lists contract findings and skips them when disabled', () => {
	const inputs = [unknownState, emptyProps];
	const raw = unitWith(ID, inputs, [bareError]);
	const checked = validator.validate(raw, FILE);
	const skipped = validator.validate(raw, FILE, { contractQuality: false });
	const direct = contractFindings(manifestOf(ID, inputs, [bareError]));
	expect(checked.errors).toEqual([
		'validator.component-manifest: contract input EvidenceGrid.state has unknown type',
		'validator.component-manifest: contract input EvidenceGrid.props is an empty props blob',
		'validator.component-manifest: contract error Error is a bare Error'
	]);
	expect(skipped.errors).toEqual([]);
	expect(direct).toEqual(checked.errors);

	recordExampleCases(meta('Lists contract findings and skips them when disabled', 'validate'), [
		{ name: 'default options', input: { id: ID, file: FILE }, output: summary(checked) },
		{
			name: 'contractQuality false',
			input: { id: ID, file: FILE, options: { contractQuality: false } },
			output: summary(skipped)
		},
		{ name: 'direct contractFindings', input: { id: ID }, output: { findings: direct } }
	]);
});

test('Counts contract findings per kind across units', () => {
	const units = [
		manifestOf(ID, [unknownState, emptyProps]),
		manifestOf(
			'reports.component.evidence-grid',
			[{ name: 'Thing.value', type: 'string', required: true }],
			[bareError]
		)
	];
	const counts = contractFailureCounts(units);
	const empty = contractFailureCounts([]);
	expect(counts).toEqual({
		entities: 2,
		issues: 3,
		unknownTypes: 1,
		emptyProps: 1,
		missingRequired: 0,
		bareErrors: 1
	});
	expect(empty.issues).toBe(0);

	recordExampleCases(
		meta('Counts contract findings per kind across units', 'contractFailureCounts'),
		[
			{
				name: 'two units with findings',
				input: { units: [ID, 'reports.component.evidence-grid'] },
				output: counts
			},
			{ name: 'no units', input: { units: [] }, output: empty }
		]
	);
});
