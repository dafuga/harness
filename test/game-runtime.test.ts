import { expect, test } from 'vitest';
import { createRun, stepGame, exampleDocument, validateDocument } from '../packages/game/src/index';

test.each(['2d', '3d'] as const)(
	'%s key, door and branch share deterministic mechanics',
	(dimension) => {
		const view = exampleDocument(dimension).views[0];
		let run = createRun(7);
		const inputs = [
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 0, choice: 'garden' }
		];
		for (const input of inputs) run = stepGame(run, input, view);
		expect(run.state.hasKey).toBe(true);
		expect(run.state.doorOpen).toBe(true);
		expect(run.state.outcome).toBe('garden');
		expect(run.completed).toEqual(['key', 'door', 'garden']);
		let replay = createRun(7);
		for (const input of inputs) replay = stepGame(replay, input, view);
		expect(replay).toEqual(run);
		expect(stepGame(run, { x: 0, y: 0 }, view).trace).toEqual(run.trace);
	}
);

test('checkpoint actions use a stable snapshot and cannot cascade within a tick', () => {
	const view = exampleDocument('2d').views[0];
	const run = stepGame(createRun(1), { x: 4, y: 0, choice: 'garden' }, view);
	expect(run.completed).toEqual(['key']);
	expect(run.state.doorOpen).toBe(false);
});

test('invalid references and unknown operations are rejected before execution', () => {
	const document = exampleDocument('2d');
	document.views[0].checkpoints[0].requires = ['missing'];
	expect(validateDocument(document)).toContain('Unknown checkpoint: missing');
	const malformed = JSON.parse(JSON.stringify(exampleDocument('2d')));
	malformed.views[0].checkpoints[0].actions[0].type = 'eval';
	expect(validateDocument(malformed).length).toBeGreaterThan(0);
});
