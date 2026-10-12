import { expect, test } from 'vitest';
import { artifactDifferences } from '../../src/utils/explorerReading';

/** What a run declares about itself, in the one place and version the reader recognises. */
const declared = (stamp: number, more: object = {}) => ({
	harnessRun: {
		version: 1,
		startedAt: stamp,
		finishedAt: stamp + 1,
		durationMs: stamp,
		pid: stamp
	},
	...more
});

test('plain text is compared as it is, and the differences of documents are named by path', () => {
	expect(artifactDifferences('one', 'one')).toEqual([]);
	expect(artifactDifferences('one', 'two')).toEqual(['']);
	const before = {
		output: { value: 1, list: [1, 2] },
		assertions: [{ name: 'a', passed: true }]
	};
	const after = {
		output: { value: 2, list: [1, 2, 3] },
		assertions: [{ name: 'a', passed: false }],
		extra: 1
	};
	expect(artifactDifferences(before, after)).toEqual([
		'assertions[0].passed',
		'extra',
		'output.list[2]',
		'output.value'
	]);
});

test('a document that declares no run is compared field by field, whatever a field is called', () => {
	// The reproduced case: a returned document whose own fields are a date and a time.
	expect(
		artifactDifferences({ date: 'Monday', time: '10:00' }, { date: 'Tuesday', time: '11:00' })
	).toEqual(['date', 'time']);
	const root = (value: number) => ({
		at: value,
		date: value,
		duration: value,
		durationMs: value,
		elapsed: value,
		finishedAt: value,
		latencyMs: value,
		pid: value,
		startedAt: value,
		time: value,
		timestamp: value,
		took: value,
		updatedAt: value
	});
	expect(artifactDifferences(root(1), root(2))).toEqual(Object.keys(root(0)));
});

test('a business document shaped like a run is still compared in every field', () => {
	// An order that has an input, an output and a trace of its own, and names times as a run would.
	const order = (value: number) => ({
		input: { date: value, pid: value },
		output: { time: value, durationMs: value },
		request: { timestamp: value },
		response: { at: value },
		steps: [{ action: 'wait', durationMs: value }],
		assertions: [{ name: 'on time', passed: true, time: value }],
		trace: [{ at: value, durationMs: value, hop: 'depot', result: { at: value } }],
		startedAt: value,
		durationMs: value
	});
	expect(artifactDifferences(order(1), order(2))).toEqual([
		'assertions[0].time',
		'durationMs',
		'input.date',
		'input.pid',
		'output.durationMs',
		'output.time',
		'request.timestamp',
		'response.at',
		'startedAt',
		'steps[0].durationMs',
		'trace[0].at',
		'trace[0].durationMs',
		'trace[0].result.at'
	]);
});

test('only what a run declares about itself is left out: its own, and that of its trace', () => {
	const traced = (stamp: number, call: string) => [
		{ call, result: { at: 'noon' }, harnessRun: { version: 1, at: stamp, durationMs: stamp } }
	];
	const run = (stamp: number, call = 'slugify') =>
		declared(stamp, { output: ['hello'], trace: traced(stamp, call) });
	expect(artifactDifferences(run(1), run(9))).toEqual([]);
	expect(artifactDifferences(run(1), run(1, 'shout'))).toEqual(['trace[0].call']);
	// One run that declares and one that has nothing to declare hold the same.
	const bare = { output: ['hello'], trace: [{ call: 'slugify', result: { at: 'noon' } }] };
	expect(artifactDifferences(run(1), bare)).toEqual([]);
	// Without a declaration at its root, what an entry of the trace carries is a field like any.
	const kept = { ...bare, trace: traced(1, 'slugify') };
	expect(artifactDifferences(run(1), kept)).toEqual(['trace[0].harnessRun']);
});

test('a declared run hides nothing but the declaration: every other time in it is a value', () => {
	const run = (value: number) =>
		declared(1, {
			date: value,
			durationMs: value,
			input: { harnessRun: { version: 1, at: value } },
			output: { time: value, harnessRun: { version: 1, at: value } },
			steps: [{ harnessRun: { at: value } }],
			trace: [
				{ at: value, result: { harnessRun: { version: 1, at: value } }, harnessRun: { version: 1 } }
			]
		});
	expect(artifactDifferences(run(1), run(2))).toEqual([
		'date',
		'durationMs',
		'input.harnessRun.at',
		'output.harnessRun.at',
		'output.time',
		'steps[0].harnessRun.at',
		'trace[0].at',
		'trace[0].result.harnessRun.at'
	]);
});

test('a declaration of no known version declares nothing, so all of it is compared', () => {
	const versions: unknown[] = [2, '1', undefined];
	for (const version of versions) {
		const run = (stamp: number) => ({
			harnessRun: { version, at: stamp },
			trace: [{ harnessRun: { at: stamp } }]
		});
		expect(artifactDifferences(run(1), run(2))).toEqual([
			'harnessRun.at',
			'trace[0].harnessRun.at'
		]);
	}
	expect(artifactDifferences({ harnessRun: 1 }, { harnessRun: 2 })).toEqual(['harnessRun']);
	expect(artifactDifferences({ harnessRun: [1] }, { harnessRun: [2] })).toEqual(['harnessRun[0]']);
});

test('an entry of a trace declares for itself: what is no declaration of this version is compared', () => {
	const run = (carried: unknown) => ({
		harnessRun: { version: 1 },
		trace: [{ harnessRun: carried }]
	});
	// The reproduced cases: a value under the reserved name, and a declaration of another version.
	expect(artifactDifferences(run('Monday'), run('Tuesday'))).toEqual(['trace[0].harnessRun']);
	expect(
		artifactDifferences(run({ version: 2, date: 'Monday' }), run({ version: 2, date: 'Tuesday' }))
	).toEqual(['trace[0].harnessRun.date']);
	expect(artifactDifferences(run({ at: 1 }), run({ at: 2 }))).toEqual(['trace[0].harnessRun.at']);
	expect(artifactDifferences(run([1]), run([2]))).toEqual(['trace[0].harnessRun[0]']);
	expect(artifactDifferences(run({ version: 1, at: 1 }), run({ version: 1, at: 2 }))).toEqual([]);
});

test('a declaration sets aside only when, how long and which process: the rest of it is compared', () => {
	const run = (value: number, name: string) => ({
		harnessRun: { version: 1, at: value, customer: name, date: name },
		trace: [{ harnessRun: { version: 1, durationMs: value, answer: name } }]
	});
	expect(artifactDifferences(run(1, 'Ada'), run(2, 'Ada'))).toEqual([]);
	expect(artifactDifferences(run(1, 'Ada'), run(1, 'Bob'))).toEqual([
		'harnessRun.customer',
		'harnessRun.date',
		'trace[0].harnessRun.answer'
	]);
	// A time that is not a time, a duration or a process that is not a number: values again.
	const typed = (startedAt: unknown, durationMs: unknown, pid: unknown) => ({
		harnessRun: { version: 1, startedAt, durationMs, pid }
	});
	expect(
		artifactDifferences(typed({ day: 'Monday' }, '1h', 'a'), typed({ day: 'Tuesday' }, '2h', 'b'))
	).toEqual(['harnessRun.durationMs', 'harnessRun.pid', 'harnessRun.startedAt.day']);
	expect(artifactDifferences(typed('10:00', 5, 7), typed(1791763952, 9, 8))).toEqual([]);
});
