import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { conditionMatches, checkpointEligible, checkpointGraph } from '../../src/utils/game-authoring/checkpointGraph';

test('Matches strict and numeric checkpoint conditions', () => {
	const cases = [
		{
			name: 'door state matches strictly',
			input: { condition: { field: 'doorOpen', op: 'eq', value: true }, state: { doorOpen: true } },
			output: conditionMatches({ field: 'doorOpen', op: 'eq', value: true }, { doorOpen: true })
		},
		{
			name: 'score meets numeric threshold',
			input: { condition: { field: 'score', op: 'gte', value: 3 }, state: { score: 4 } },
			output: conditionMatches({ field: 'score', op: 'gte', value: 3 }, { score: 4 })
		},
		{
			name: 'ordered comparison rejects text',
			input: { condition: { field: 'score', op: 'lte', value: 3 }, state: { score: '2' } },
			output: conditionMatches({ field: 'score', op: 'lte', value: 3 }, { score: '2' })
		}
	];
	expect(cases.map((item) => item.output)).toEqual([true, true, false]);
	recordExampleCases(
		{ unitId: 'game.function.checkpoint-graph', symbol: 'conditionMatches', state: 'matches-strict-and-numeric-checkpoint-conditions', evidence: 'examples-cases', file: 'matches-strict-and-numeric-checkpoint-conditions.json' },
		cases
	);
});

test('Checks completion prerequisites and conditions', () => {
	const node = {
		id: 'open-door', title: 'Open the Door', description: 'Open after finding the key.', x: 160, y: 90,
		requires: ['find-key'], conditions: [{ field: 'score', op: 'gte' as const, value: 3 }],
		actions: [{ type: 'set' as const, target: 'doorOpen', value: true }]
	};
	const eligibleRun = { tick: 2, seed: 17, state: { score: 3 }, completed: ['find-key'], events: [], trace: [] };
	const cases = [
		{ name: 'required key and score are present', input: { node, run: eligibleRun }, output: checkpointEligible(node, eligibleRun) },
		{ name: 'already completed checkpoint cannot repeat', input: { node, run: { ...eligibleRun, completed: ['find-key', 'open-door'] } }, output: checkpointEligible(node, { ...eligibleRun, completed: ['find-key', 'open-door'] }) }
	];
	expect(cases.map((item) => item.output)).toEqual([true, false]);
	recordExampleCases(
		{ unitId: 'game.function.checkpoint-graph', symbol: 'checkpointEligible', state: 'checks-completion-prerequisites-and-conditions', evidence: 'examples-cases', file: 'checks-completion-prerequisites-and-conditions.json' },
		cases
	);
});

test('Applies eligible checkpoints in stable id order', () => {
	const run = { tick: 2, seed: 17, state: { score: 3, doorOpen: false }, completed: [], events: [], trace: [] };
	const checkpoints = [
		{ id: 'z-finish', title: 'Finish', description: 'Emit the finish event.', x: 2, y: 1, requires: [], conditions: [], actions: [{ type: 'emit' as const, target: 'finished', value: true }] },
		{ id: 'a-open', title: 'Open', description: 'Open the door.', x: 1, y: 1, requires: [], conditions: [{ field: 'score', op: 'gte' as const, value: 3 }], actions: [{ type: 'set' as const, target: 'doorOpen', value: true }] }
	];
	const view = { id: 'opening', title: 'Opening', dimension: '2d' as const, style: 'flat ink illustration', checkpoints };
	const result = checkpointGraph(run, view);
	const summary = { state: result.state, completed: result.completed, events: result.events, trace: result.trace.map(({ checkpointId, reason }) => ({ checkpointId, reason })) };
	const cases = [{ name: 'eligible actions run in id order from the initial snapshot', input: { run, view }, output: summary }];
	expect(summary.completed).toEqual(['a-open', 'z-finish']);
	expect(run.state.doorOpen).toBe(false);
	recordExampleCases(
		{ unitId: 'game.function.checkpoint-graph', symbol: 'checkpointGraph', state: 'applies-eligible-checkpoints-in-stable-id-order', evidence: 'examples-cases', file: 'applies-eligible-checkpoints-in-stable-id-order.json' },
		cases
	);
});
