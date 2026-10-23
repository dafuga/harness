import { expect, test } from 'vitest';
import { BenchmarkDefinitionValidator } from '../../src/cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';
import { benchmarkFixtureDefinition } from '../support/benchmark';

test('contracts reject traversal, duplicates, unsupported settings and unknown keys', () => {
	const validator = new BenchmarkDefinitionValidator();
	const base = benchmarkFixtureDefinition();
	for (const allowedFiles of [
		['../outside.ts'],
		['/outside.ts'],
		['.git/config'],
		['.GIT/config'],
		['a/../outside.ts'],
		['a', 'a']
	])
		expect(() => validator.validate({ ...base, allowedFiles })).toThrow();
	expect(() => validator.validate({ ...base, benchmarkSecret: 'no' })).toThrow();
	expect(() =>
		validator.validate({ ...base, candidates: [{ ...base.candidates[0], tools: 'files' }] })
	).toThrow();
	expect(() => validator.validate({ ...base, budget: { repairs: -1 } })).toThrow();
	expect(() => validator.validate({ ...base, checks: [] })).toThrow();
});
