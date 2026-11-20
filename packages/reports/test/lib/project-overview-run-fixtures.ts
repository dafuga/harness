/** Synthetic tracker run and computer records. Their process and session counts are never project totals. */

/** Runs whose project field disagrees with the item's agent, duplicated and offline views included. */
export function syntheticRuns(): Record<string, unknown>[] {
	return [
		{ id: 101, node: 'box', item_id: 'g1', state: 'running', project: 'wrong-project' },
		{ id: 101, node: 'box', item_id: 'g1', state: 'running', project: 'wrong-project' },
		{ id: 102, node: 'mb2', item_id: 'g1', state: 'running', project: 'gamma-api' },
		{ id: 103, node: 'box', item_id: 'g1', state: 'finished', project: 'gamma-api' },
		{ id: 104, node: 'box', item_id: 'n1', state: 'running', project: 'nu-hidden' },
		{ id: 105, node: 'box', item_id: 'missing', state: 'running', project: null },
		{ id: 106, node: 'box', item_id: 'd1', state: 'running', project: 'delta-docs' }
	];
}

/** Computers with status values. Their session and process counts are not project totals. */
export function syntheticMachines(): Record<string, unknown>[] {
	return [
		{ node: 'box', role: 'primary', status: 'ok', reasons: [], agents: { claude: 7, codex: 2 } },
		{ node: 'mb2', role: 'runner', status: 'offline', reasons: ['no sample for 40 min'] },
		{ node: 'primary', role: 'primary', status: 'busy', reasons: ['CPU busy'] },
		{ node: 'runner', role: 'runner', status: 'overloaded', reasons: ['RAM low'] }
	];
}
