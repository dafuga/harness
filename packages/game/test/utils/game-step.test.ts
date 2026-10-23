import { expect, test } from 'vitest';
import { createRun, stepGame, exampleDocument } from '../../src/index';
test('independent mechanics merge patches and reject conflicting writes', () => {
	const run = createRun();
	const view = exampleDocument().views[0];
	expect(
		stepGame(run, { x: 0, y: 0 }, view, [
			{ id: 'a', step: () => ({ hp: 10 }) },
			{ id: 'b', step: () => ({ coins: 2 }) }
		]).state
	).toMatchObject({ hp: 10, coins: 2 });
	expect(() =>
		stepGame(run, { x: 0, y: 0 }, view, [
			{ id: 'a', step: () => ({ hp: 10 }) },
			{ id: 'b', step: () => ({ hp: 2 }) }
		])
	).toThrow('Conflicting');
	const planned = Object.assign(globalThis.structuredClone(view), {
		planning: { concept: 'A quiet island', description: 'A bridge leads to the exit.' }
	});
	expect(() => stepGame(run, { x: 1, y: 0 }, planned)).toThrow('Approve and build');
});

test('checkpoint progress belongs to its view while mechanics state survives transitions', () => {
	const first = exampleDocument().views[0];
	const second = { ...globalThis.structuredClone(first), id: 'second' };
	first.checkpoints[0].actions.push({ type: 'transition', target: 'second', value: true });
	let run = stepGame(createRun(), { x: 2, y: 0 }, first);
	expect(run.state.view).toBe('second');
	run = stepGame(run, { x: 0, y: 0 }, second);
	expect(run.completed).toEqual(['key']);
	expect(run.state.hasKey).toBe(true);
	expect(run.trace).toHaveLength(2);
});
