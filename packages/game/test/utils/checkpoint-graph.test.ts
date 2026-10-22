import { expect, test } from 'vitest';
import { checkpointGraph, createRun, exampleDocument } from '../../src/index';
test('repeatable nodes fire once per tick', () => {
	const view = exampleDocument().views[0];
	view.checkpoints = [{ ...view.checkpoints[0], repeatable: true, conditions: [] }];
	let run = checkpointGraph(createRun(), view);
	expect(run.trace).toHaveLength(1);
	run = checkpointGraph({ ...run, tick: 1 }, view);
	expect(run.trace).toHaveLength(2);
});

test('emitted event values can trigger a checkpoint on the following tick', () => {
	const view = exampleDocument().views[0];
	view.checkpoints[1].requires = [];
	view.checkpoints[1].conditions = [{ field: 'event:key-collected', op: 'eq', value: true }];
	let run = createRun();
	run.state.x = 2;
	run = checkpointGraph(run, view);
	expect(run.completed).toEqual(['key']);
	run = checkpointGraph({ ...run, tick: 1 }, view);
	expect(run.completed).toEqual(['key', 'door']);
});
