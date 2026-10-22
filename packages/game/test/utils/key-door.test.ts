import { expect, test } from 'vitest';
import { keyDoor, createRun } from '../../src/index';
test('locked door blocks movement and inputs do not mutate state', () => {
	const run = createRun();
	expect(keyDoor(run.state, { x: 10, y: 0 }).x).toBe(3);
	expect(run.state.x).toBe(0);
});
