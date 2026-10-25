import { expect, test } from 'vitest';
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
});

test('example asserts authored comments for successful and error inputs', async () => {
	const example = { name: 'Round a value', call: 'round(1.2)', input: 1.2, output: 1 };
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
	const unit = manifest.default as import('../../../src/core/unitTypes').ComponentManifest;
	service.registerExamples((title, run) => registered.push({ title, run }), unit, functions);
	expect(registered).toHaveLength(
		unit.helperContracts!.reduce((count, helper) => count + helper.examples!.length, 0)
	);
	for (const item of registered) await item.run();
	expect(() => service.registerExamples(() => {}, unit, {})).toThrow('Missing executable examples');
	expect(() =>
		service.registerExamples(() => {}, { ...unit, helperContracts: [] }, functions)
	).toThrow('Missing authored Examples');
});
