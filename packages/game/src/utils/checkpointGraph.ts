import type { Checkpoint, Condition, GameRun, GameState, GameView } from '../models/Game.types';

export function conditionMatches(condition: Condition, state: Readonly<GameState>): boolean {
	const current = state[condition.field];
	if (condition.op === 'eq') return current === condition.value;
	if (typeof current !== 'number' || typeof condition.value !== 'number') return false;
	return condition.op === 'gte' ? current >= condition.value : current <= condition.value;
}

export function checkpointEligible(node: Checkpoint, run: GameRun): boolean {
	return (
		(Boolean(node.repeatable) || !run.completed.includes(node.id)) &&
		node.requires.every((id) => run.completed.includes(id)) &&
		node.conditions.every((condition) => conditionMatches(condition, run.state))
	);
}

export function checkpointGraph(run: GameRun, view: GameView): GameRun {
	const eligible = view.checkpoints
		.filter((node) => checkpointEligible(node, run))
		.sort((a, b) => a.id.localeCompare(b.id));
	const next = {
		...run,
		state: { ...run.state },
		completed: [...run.completed],
		events: [...run.events],
		trace: [...run.trace]
	};
	for (const node of eligible) applyCheckpoint(next, node);
	return next;
}

function applyCheckpoint(run: GameRun, node: Checkpoint): void {
	for (const action of node.actions) {
		if (action.type === 'emit') {
			run.events.push(action.target);
			run.state['event:' + action.target] = action.value;
		} else if (action.type === 'transition') run.state.view = action.target;
		else if (action.type === 'visibility') run.state['visible:' + action.target] = action.value;
		else run.state[action.target] = action.value;
	}
	if (!run.completed.includes(node.id)) run.completed.push(node.id);
	run.trace.push({
		viewId: run.viewId,
		tick: run.tick,
		checkpointId: node.id,
		reason:
			node.conditions.map((c) => c.field + ' ' + c.op + ' ' + String(c.value)).join(' AND ') ||
			'Prerequisites satisfied'
	});
	// Keep long previews bounded without changing the simulation state.
	run.trace = run.trace.slice(-1000);
	run.events = run.events.slice(-1000);
}
