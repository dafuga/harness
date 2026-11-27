import { test } from 'vitest';
import { z } from 'zod';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sourceContractSchema } from '../../src/core/development-tooling/contractSchemas';
import {
	unitIdPattern,
	dependencyVias,
	runtimeKinds,
	performanceMetrics,
	performanceTolerance,
	contractItemSchema,
	unitDependencySchema,
	performanceBudgetSchema,
	executionTargetSchema,
	scenarioManifestSchema
} from '../../src/core/development-tooling/unitTypes';

const item = { name: ' accountId ', type: ' string ' };
const scenario = {
	schemaVersion: 1,
	id: 'account-flow',
	title: 'Account flow',
	kind: 'headless',
	units: ['function.unit-types'],
	states: [{ id: 'valid-input', title: 'Valid input', coverage: 'required' }],
	viewports: [],
	tests: [
		{
			id: 'valid-input',
			kind: 'unit',
			runner: 'vitest',
			target: 'test/examples/function.unit-types.test.ts'
		}
	],
	evidence: []
};

test('Contract items and source facts validate strictly', () => {
	const accepted = contractItemSchema.parse(item);
	const rejected = contractItemSchema.safeParse({ ...item, extra: true }).success;
	const explicit = { name: 'option', type: 'string', required: false, defaultKind: 'undefined' };
	const legacy = {
		name: 'option',
		type: 'string',
		required: false,
		default: 'undefined (omitted)'
	};
	expect(contractItemSchema.parse(explicit)).toEqual(explicit);
	expect(contractItemSchema.parse(legacy)).toEqual(legacy);
	expect(contractItemSchema.safeParse({ ...explicit, default: null }).success).toBe(false);
	const reader = sourceContractSchema(contractItemSchema);
	const source = reader.parse({
		origin: 'declared',
		inputs: [item],
		outputs: [],
		errors: [],
		storage: [{ name: 'accounts', fields: [{ ...item, nullable: true }], unresolved: [] }]
	});
	expect(
		reader.safeParse({
			...source,
			storage: [{ name: 'accounts', fields: [{ ...explicit, default: null }] }]
		}).success
	).toBe(false);
	expect(z.toJSONSchema(contractItemSchema).not).toEqual({ required: ['default', 'defaultKind'] });
	expect(z.toJSONSchema(reader.shape.storage.unwrap().element.shape.fields.element).not).toEqual({
		required: ['default', 'defaultKind']
	});
	expect([accepted.name, accepted.type, rejected, source.storage?.[0].fields[0].nullable]).toEqual([
		'accountId',
		'string',
		false,
		true
	]);
	recordExampleCases(
		{
			unitId: 'function.unit-types',
			symbol: 'sourceContractSchema',
			state: 'contract-items-and-source-facts-validate-strictly',
			evidence: 'examples-cases',
			file: 'contract-items-and-source-facts-validate-strictly.json'
		},
		[
			{
				name: 'trimmed strict contract item and additive storage field',
				input: { item, extraKey: true },
				output: {
					name: accepted.name,
					type: accepted.type,
					rejectsExtra: !rejected,
					storageNullable: true
				}
			}
		]
	);
});

test('Dependency and runtime schemas enforce their declared vocab', () => {
	const dependency = { unit: 'function.unit-types', via: 'contract', origin: 'declared' };
	const budget = {
		workload: 'schema-parse',
		metric: 'latency-warm-ms',
		tolerance: performanceTolerance,
		target: 'module'
	};
	const target = { kind: 'module', entry: 'src/unit.ts' };
	const results = {
		dependency: unitDependencySchema.safeParse(dependency).success,
		badDependency: unitDependencySchema.safeParse({ ...dependency, via: 'other' }).success,
		budget: performanceBudgetSchema.safeParse(budget).success,
		overTolerance: performanceBudgetSchema.safeParse({ ...budget, tolerance: 0.06 }).success,
		target: executionTargetSchema.parse(target)
	};
	expect([
		results.dependency,
		results.badDependency,
		results.budget,
		results.overTolerance,
		results.target.handler
	]).toEqual([true, false, true, false, undefined]);
	expect([
		unitIdPattern.test('feature.unit-types'),
		dependencyVias.length,
		runtimeKinds,
		performanceMetrics
	]).toEqual([
		true,
		10,
		['module', 'wasm', 'process', 'http'],
		['latency-cold-ms', 'latency-warm-ms', 'latency-floor-ms', 'throughput-ops', 'memory-bytes']
	]);
	recordExampleCases(
		{
			unitId: 'function.unit-types',
			symbol: 'unitDependencySchema',
			state: 'dependency-and-runtime-schemas-enforce-their-declared-vocab',
			evidence: 'examples-cases',
			file: 'dependency-and-runtime-schemas-enforce-their-declared-vocab.json'
		},
		[
			{
				name: 'declared contract dependency and supported module budget',
				input: { dependency, budget, target },
				output: {
					dependencyAccepted: results.dependency,
					budgetAccepted: results.budget,
					handler: null
				}
			},
			{
				name: 'unknown relation and tolerance above policy',
				input: { via: 'other', tolerance: 0.06 },
				output: { dependencyAccepted: results.badDependency, budgetAccepted: results.overTolerance }
			}
		]
	);
});

test('Scenario manifests require state coverage and a test', () => {
	const parsed = scenarioManifestSchema.parse(scenario);
	const missingState = scenarioManifestSchema.safeParse({ ...scenario, states: [] }).success;
	const missingTest = scenarioManifestSchema.safeParse({ ...scenario, tests: [] }).success;
	expect([
		parsed.id,
		parsed.states[0].coverage,
		parsed.viewports.length,
		missingState,
		missingTest
	]).toEqual(['account-flow', 'required', 0, false, false]);
	recordExampleCases(
		{
			unitId: 'function.unit-types',
			symbol: 'scenarioManifestSchema',
			state: 'scenario-manifests-require-state-coverage-and-a-test',
			evidence: 'examples-cases',
			file: 'scenario-manifests-require-state-coverage-and-a-test.json'
		},
		[
			{
				name: 'headless scenario declares a required state and unit test',
				input: scenario,
				output: {
					id: parsed.id,
					state: parsed.states[0].id,
					test: parsed.tests[0].runner,
					viewportCount: parsed.viewports.length
				}
			},
			{
				name: 'scenario without states or tests is rejected',
				input: { states: [], tests: [] },
				output: { missingStateAccepted: missingState, missingTestAccepted: missingTest }
			}
		]
	);
});

test('Throws ZodError when contract items contain undeclared keys', () => {
	const invalidItem = { ...item, extra: true };
	let errorName = '';
	try {
		contractItemSchema.parse(invalidItem);
	} catch (error) {
		errorName = error instanceof Error ? error.name : 'unknown';
	}
	expect(errorName).toBe('ZodError');
	recordExampleCases(
		{
			unitId: 'function.unit-types',
			symbol: 'contractItemSchema',
			state: 'throws-zoderror-when-contract-items-contain-undeclared-keys',
			evidence: 'examples-cases',
			file: 'throws-zoderror-when-contract-items-contain-undeclared-keys.json'
		},
		[
			{
				name: 'strict contract item rejects an undeclared key',
				input: invalidItem,
				error: { name: errorName }
			}
		]
	);
});
