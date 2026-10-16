import { expect as original, afterEach } from 'vitest';
import { types } from 'node:util';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { observationValue, type ObservationValue } from './verificationValues';

export interface AssertionObservation {
	schemaVersion: 1;
	kind: 'matcher';
	invocation: string;
	testName: string;
	matcher: string;
	modifiers: string[];
	actual: ObservationValue;
	expected: ObservationValue[];
	passed: boolean;
	error?: ObservationValue;
}
const counters = new Map<string, { started: number; completed: number }>();
interface Context {
	testName: string;
	observed: { value: unknown };
	modifiers: string[];
	poll?: boolean;
}
function record(
	context: Context,
	matcher: string,
	expected: unknown[],
	outcome: { passed: boolean; error?: unknown }
): void {
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || !process.env.HARNESS_SCENARIO) return;
	const line: AssertionObservation = {
		schemaVersion: 1,
		kind: 'matcher',
		invocation: process.env.HARNESS_ASSERTION_RUN_ID ?? '',
		testName: context.testName,
		matcher,
		modifiers: context.modifiers,
		actual: observationValue(context.observed.value),
		expected: expected.map((value) => observationValue(value)),
		passed: outcome.passed,
		...(outcome.error === undefined ? {} : { error: observationValue(outcome.error) })
	};
	mkdirSync(directory, { recursive: true });
	appendFileSync(join(directory, 'assertions.ndjson'), `${JSON.stringify(line)}\n`);
}
function settled(value: unknown, context: Context): unknown {
	if (!types.isPromise(value)) return value;
	return value.then(
		(actual) => {
			context.observed.value = actual;
			return actual;
		},
		(error) => {
			context.observed.value = error;
			throw error;
		}
	);
}
function input(value: unknown, context: Context, promise: boolean): unknown {
	if (typeof value === 'function')
		return function (this: unknown, ...args: unknown[]) {
			try {
				const result = Reflect.apply(value, this, args);
				return promise ? settled(result, context) : result;
			} catch (error) {
				context.observed.value = error;
				throw error;
			}
		};
	return promise ? settled(value, context) : value;
}
function thenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'then' in value &&
		typeof value.then === 'function'
	);
}
function outcome(context: Context, matcher: string, expected: unknown[]) {
	const count = counters.get(context.testName) ?? { started: 0, completed: 0 };
	counters.set(context.testName, count);
	count.started++;
	return (passed: boolean, error?: unknown) => {
		count.completed++;
		record(context, matcher, expected, { passed, error });
	};
}
function match(target: object, context: Context, matcher: string, expected: unknown[]): unknown {
	const done = outcome(context, matcher, expected);
	const value = Reflect.get(target, '_obj');
	const wrap = matcher.startsWith('toThrow') && context.modifiers.every((item) => item === 'not');
	try {
		if (wrap) Reflect.set(target, '_obj', input(value, context, false));
		const result = Reflect.apply(Reflect.get(target, matcher), target, expected);
		if (thenable(result))
			return result.then(
				(value) => {
					done(true);
					return value;
				},
				(error) => {
					done(false, error);
					throw error;
				}
			);
		done(true);
		return result;
	} catch (error) {
		done(false, error);
		throw error;
	} finally {
		if (wrap) Reflect.set(target, '_obj', value);
	}
}
function property(target: object, context: Context, key: string): unknown {
	const modifier = ['not', 'resolves', 'rejects'].includes(key);
	const next = modifier ? { ...context, modifiers: [...context.modifiers, key] } : context;
	try {
		if ((key === 'resolves' || key === 'rejects') && !context.poll)
			Reflect.set(target, '_obj', input(Reflect.get(target, '_obj'), next, true));
		const value = Reflect.get(target, key);
		if (modifier) return instrument(value as object, next);
		return typeof value === 'function'
			? (...args: unknown[]) => match(target, context, key, args)
			: value;
	} catch (error) {
		outcome(next, key, [])(false, error);
		throw error;
	}
}
function instrument(target: object, context: Context): object {
	return new Proxy(target, {
		get(value, key) {
			return typeof key === 'string' && key !== 'then'
				? property(value, context, key)
				: Reflect.get(value, key);
		}
	});
}
function poll(...args: unknown[]): object {
	const context: Context = {
		testName: original.getState().currentTestName ?? '',
		observed: { value: undefined },
		modifiers: ['poll'],
		poll: true
	};
	const [callback, ...options] = args;
	const actual = Reflect.apply(original.poll, original, [
		async (...values: unknown[]) => {
			try {
				const value = await Reflect.apply(
					callback as (...args: unknown[]) => unknown,
					undefined,
					values
				);
				context.observed.value = value;
				return value;
			} catch (error) {
				context.observed.value = error;
				throw error;
			}
		},
		...options
	]);
	return instrument(actual, context);
}
export const expect: typeof original = new Proxy(original, {
	apply(target, receiver, args) {
		const assertion = Reflect.apply(target, receiver, args);
		return process.env.HARNESS_SCENARIO
			? instrument(assertion, {
					testName: original.getState().currentTestName ?? '',
					observed: { value: args[0] },
					modifiers: []
				})
			: assertion;
	},
	get(target, key, receiver) {
		return key === 'poll' && process.env.HARNESS_SCENARIO
			? poll
			: Reflect.get(target, key, receiver);
	}
});
afterEach(() => {
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	const state = original.getState();
	const testName = state.currentTestName ?? '';
	const count = counters.get(testName) ?? { started: 0, completed: 0 };
	counters.delete(testName);
	if (!directory || !process.env.HARNESS_SCENARIO) return;
	mkdirSync(directory, { recursive: true });
	appendFileSync(
		join(directory, 'assertions.ndjson'),
		`${JSON.stringify({
			schemaVersion: 1,
			kind: 'complete',
			invocation: process.env.HARNESS_ASSERTION_RUN_ID ?? '',
			testName,
			observed: count.completed,
			...count,
			assertionCalls: state.assertionCalls
		})}\n`
	);
});
