import { test, expect as check } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect as observed } from './verificationExpect';
import { observationValue } from './verificationValues';

test('observed matchers retain identity, promise, negation, throw and poll behavior without extra calls', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-assertions-'));
	const keys = ['HARNESS_EVIDENCE_DIR', 'HARNESS_SCENARIO', 'HARNESS_ASSERTION_RUN_ID'] as const;
	const saved = keys.map((key) => process.env[key]);
	try {
		process.env.HARNESS_EVIDENCE_DIR = directory;
		process.env.HARNESS_SCENARIO = 'semantics';
		process.env.HARNESS_ASSERTION_RUN_ID = 'semantic-test';
		let calls = 0;
		const error = new Error('same error');
		const operation = () => {
			calls++;
			throw error;
		};
		observed(operation).toBe(operation);
		observed(operation).toThrow(error);
		observed(1).not.toBe(2);
		await observed(Promise.resolve({ value: 3 })).resolves.toEqual({ value: 3 });
		await observed(() => {
			calls++;
			return Promise.reject(error);
		}).rejects.toBe(error);
		let polls = 0;
		const beforePoll = check.getState().assertionCalls;
		await observed.poll(() => ++polls, { interval: 1 }).toBe(2);
		check(check.getState().assertionCalls - beforePoll).toBe(1);
		await observed(Promise.resolve(4)).resolves.not.toBe(3);
		await observed.poll(() => 5).not.toBe(4);
		check(() => observed(1).toBe(2)).toThrow();
		check(() => observed(1).resolves.toBe(1)).toThrow('Promise');
		check(calls).toBe(2);
		check(polls).toBe(2);
		const lines = (await readFile(join(directory, 'assertions.ndjson'), 'utf8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		check(lines).toHaveLength(10);
		check(
			lines.every(
				(line) => line.testName.includes('observed matchers') && line.invocation === 'semantic-test'
			)
		).toBe(true);
		check(lines[1]).toMatchObject({ actual: { message: 'same error' }, passed: true });
		check(lines[3]).toMatchObject({ actual: { value: 3 }, modifiers: ['resolves'] });
		check(lines[5]).toMatchObject({ actual: 2, modifiers: ['poll'], passed: true });
		check(lines[6]).toMatchObject({ actual: 4, modifiers: ['resolves', 'not'] });
		check(lines[7]).toMatchObject({ actual: 5, modifiers: ['poll', 'not'] });
		check(lines.slice(-2).every((line) => !line.passed)).toBe(true);
	} finally {
		keys.forEach((key, i) =>
			saved[i] === undefined ? delete process.env[key] : (process.env[key] = saved[i])
		);
		await rm(directory, { recursive: true, force: true });
	}
});
test('observation serialization does not run getters, proxies, custom prototypes or byte conversions', () => {
	let calls = 0;
	const object = {
		get secret() {
			calls++;
			throw Error('getter');
		},
		toJSON() {
			calls++;
		}
	};
	check(observationValue(object)).toEqual({
		secret: { type: 'accessor' },
		toJSON: { type: 'function' }
	});
	check(observationValue(new AbortController().signal)).toEqual({ type: 'opaque-object' });
	check(
		observationValue(
			new Proxy(
				{},
				{
					getPrototypeOf() {
						calls++;
						throw Error('proxy');
					}
				}
			)
		)
	).toEqual({ type: 'opaque-proxy' });
	check(observationValue(new Uint8Array([1, 2]))).toMatchObject({
		type: 'bytes',
		length: 2,
		sha256: check.stringMatching(/^[a-f0-9]{64}$/)
	});
	check(calls).toBe(0);
});

test('observed expectation construction and modifier getters retain native Vitest timing', async () => {
	const saved = process.env.HARNESS_SCENARIO;
	process.env.HARNESS_SCENARIO = 'semantics';
	try {
		let calls = 0;
		const before = check.getState().assertionCalls;
		const pending = observed(() => {
			calls++;
			return Promise.reject(new Error('late'));
		}).rejects;
		check(check.getState().assertionCalls - before).toBe(1);
		check(calls).toBe(1);
		await pending.toThrow('late');
		check(() => observed(1).resolves).toThrow('Promise');
	} finally {
		if (saved === undefined) delete process.env.HARNESS_SCENARIO;
		else process.env.HARNESS_SCENARIO = saved;
	}
});

test('byte and regex observations bypass overridden instance accessors', () => {
	let calls = 0;
	const trap = () => {
		calls++;
		throw new Error('Accessor must not execute');
	};
	const bytes = new Uint8Array([1, 2]);
	Object.defineProperty(bytes, 'buffer', { get: trap });
	const pattern = /fixture/gi;
	Object.defineProperty(pattern, 'source', { get: trap });
	check(observationValue(bytes)).toMatchObject({ type: 'bytes', length: 2 });
	check(observationValue(pattern)).toEqual({
		type: 'regexp',
		source: 'fixture',
		flags: 'global,ignoreCase'
	});
	check(calls).toBe(0);
});
