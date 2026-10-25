import { assertAuthoredJsonFields } from '../../support/testExpectationAuthoredCases';
import { assertRegisteredResults } from '../../support/testExpectationRegistrationCases';
import {
	assertJsonAdmission,
	assertCompleteJsonFields
} from '../../support/testExpectationJsonCases';
import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { TestExpectationService } from '../../../src/services/verification-evidence/TestExpectationService';

const service = new TestExpectationService();
test('json checks complete responses, type-preserving scalar normalization and errors', () => {
	const response = { id: 1, values: [false, 0, '', null], request: { nonce: 'actual' } };
	const expected = { request: { nonce: 'expected' }, values: [false, 0, '', null], id: 1 };
	expect(() => service.json(response, expected, ['request.nonce'])).not.toThrow();
	expect(() => service.json(response, expected)).toThrow('API JSON differs');
	for (const changed of [
		{ ...expected, extra: true },
		{ ...expected, id: '1' },
		{ ...expected, values: [false, 0, '', null, 1] },
		{ ...expected, values: undefined }
	])
		expect(() => service.json(response, changed, ['request.nonce'])).toThrow();
	expect(() =>
		service.json(response, { ...expected, request: { nonce: 1 } }, ['request.nonce'])
	).toThrow('API JSON differs');
	for (const path of ['missing', 'request', 'request.*', '__proto__.polluted'])
		expect(() => service.json(response, expected, [path])).toThrow();
	expect(response.request.nonce).toBe('actual');
	assertJsonAdmission(service);
	assertCompleteJsonFields(service);
});

test('example asserts authored comments for successful and error inputs', async () => {
	const example = { name: 'Round a value', call: 'round(1.2)', input: 1.2, output: 1 };
	const empty = { name: 'No return value', call: 'run()', input: null, returns: 'void' as const };
	await expect(service.example(() => undefined, empty)).resolves.toHaveProperty(
		'output',
		undefined
	);
	await expect(service.example(() => 1, empty)).rejects.toThrow('differs from its comment');
	await expect(
		service.example((input) => Math.round(input as number), example)
	).resolves.toMatchObject({ output: 1 });
	await expect(service.example(() => 2, example)).rejects.toThrow('differs from its comment');
	const failure = { name: 'Reject missing input', input: null, error: 'Missing input' };
	await expect(
		service.example(() => {
			throw new Error('Missing input');
		}, failure)
	).resolves.toMatchObject({ error: 'Missing input' });
	await expect(service.example(() => 1, failure)).rejects.toThrow('Expected example to fail');
	await expect(
		service.example(() => {
			throw new Error('Unexpected');
		}, example)
	).rejects.toThrow('unexpectedly failed');
});

test('registerExamples registers exactly the authored examples and rejects absent implementations', async () => {
	const manifest = await import('../../../specification/units/function.case.json');
	const functions = await import('../../../src/helpers/strings/case');
	const registered: Array<{ title: string; run: () => Promise<void> }> = [];
	const unit = manifest.default as ComponentManifest;
	service.registerExamples((title, run) => registered.push({ title, run }), unit, functions);
	expect(registered).toHaveLength(
		unit.helperContracts!.reduce((count, helper) => count + helper.examples!.length, 0)
	);
	for (const item of registered) await item.run();
	expect(() =>
		service.registerExamples(() => {}, unit, {
			...functions,
			unregistered: () => 'unregistered'
		})
	).toThrow('Unsupported example implementation');
	await assertFixtureExamples(unit);
	await assertAuthoredJsonFields(service);
	expect(() => service.registerExamples(() => {}, unit, {})).toThrow('Missing executable examples');
	expect(() =>
		service.registerExamples(() => {}, { ...unit, helperContracts: [] }, functions)
	).toThrow('Missing authored Examples');
});

async function assertFixtureExamples(unit: ComponentManifest) {
	const fixture = {
		...unit,
		helperContracts: [],
		testing: {
			version: 1 as const,
			shape: 'helper' as const,
			states: ['initialized'],
			cases: [
				{
					id: 'integration',
					state: 'initialized',
					subject: 'runFixture',
					example: 'Retain disposable integration assertions',
					test: {
						file: 'test/fixture.test.ts',
						title: 'runFixture: Retain disposable integration assertions'
					}
				}
			],
			examples: [
				{
					subject: 'runFixture',
					name: 'Retain disposable integration assertions',
					call: 'runFixture()',
					input: null,
					expected: { kind: 'void' as const }
				}
			]
		}
	};
	const general: Array<{ title: string; run: () => Promise<void> }> = [];
	service.registerExamples((title, run) => general.push({ title, run }), fixture, {
		runFixture: async () => {}
	});
	expect(general.map((item) => item.title)).toEqual([
		'runFixture: Retain disposable integration assertions'
	]);
	await general[0].run();
	expect(() =>
		service.registerExamples(
			() => {},
			{ ...fixture, testing: { ...fixture.testing, cases: [] } },
			{ runFixture: async () => {} }
		)
	).toThrow('Invalid authored Examples');
}

test('registerCases binds complete method matrices and API results to canonical file identities', async () => {
	const file = 'test/runner.test.ts';
	const unit = await registrationUnit(file);
	const registered: Array<{ title: string; run: () => Promise<void> }> = [];
	const register = (title: string, run: () => Promise<void>) => registered.push({ title, run });
	let calls = 0;
	service.registerCases(register, unit, file, {
		'run.initialized': () => {
			calls++;
		}
	});
	expect(registered.map((item) => item.title)).toEqual(['Runner.run initialized']);
	expect(calls).toBe(0);
	await registered[0].run();
	expect(calls).toBe(1);
	await assertRegisteredResults(service, unit, file);
	expect(() => service.registerCases(register, unit, file, {})).toThrow(
		'Missing case implementation'
	);
	expect(() => service.registerCases(register, unit, file, { extra: () => {} })).toThrow(
		'Unsupported case implementation'
	);
	expect(() => service.registerCases(register, unit, 'test/other.test.ts', {})).toThrow(
		'No declared cases'
	);
	const api = {
		...unit,
		testing: {
			...unit.testing!,
			shape: 'api' as const,
			cases: [
				{
					...unit.testing!.cases[0],
					expected: { kind: 'json' as const, value: { ok: true, count: 0 } }
				}
			]
		}
	};
	registered.length = 0;
	service.registerCases(register, api, file, { 'run.initialized': () => ({ ok: true, count: 0 }) });
	await registered[0].run();
	registered.length = 0;
	service.registerCases(register, api, file, {
		'run.initialized': () => ({ ok: true, count: '0' })
	});
	await expect(registered[0].run()).rejects.toThrow('API JSON differs');
});

async function registrationUnit(file: string): Promise<ComponentManifest> {
	const loaded = await import('../../../specification/units/function.case.json');
	return {
		...(loaded.default as ComponentManifest),
		helperContracts: [],
		owns: { source: [], symbols: ['Runner.run'] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		testing: {
			version: 1,
			shape: 'service',
			states: ['initialized'],
			cases: [
				{
					id: 'run.initialized',
					subject: 'Runner.run',
					state: 'initialized',
					test: { file, title: 'Runner.run initialized' },
					expected: { kind: 'void' }
				}
			]
		}
	};
}
