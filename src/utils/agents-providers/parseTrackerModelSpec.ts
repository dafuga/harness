// @harness-uid u_b5x7mlx577
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';

export const solEfforts = ['low', 'medium', 'high', 'xhigh'];

// Tracker's flat transcript estimates, in USD per million tokens.
const defaultLadder: readonly TrackerModelRung[] = [
	{
		id: 'haiku',
		cli: 'claude',
		model: 'claude-haiku-5-5',
		effort: 'high',
		price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.2 }
	},
	{
		id: 'sonnet',
		cli: 'claude',
		model: 'claude-sonnet-5-5',
		effort: 'medium',
		price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 4 }
	},
	{ id: 'terra', cli: 'codex', model: 'gpt-6.1-terra', effort: 'medium', price: null },
	{ id: 'sol', cli: 'codex', model: 'gpt-6.2-sol', effort: 'medium', price: null },
	{
		id: 'opus',
		cli: 'claude',
		model: 'claude-opus-5-5',
		effort: 'high',
		price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 }
	},
	{ id: 'astra', cli: 'codex', model: 'gpt-6.2-astra', effort: 'high', price: null }
];

const pinnedModels: readonly TrackerModelRung[] = [
	{ id: 'luna', cli: 'codex', model: 'gpt-6-luna', effort: 'medium', price: null },
	{
		id: 'fable',
		cli: 'claude',
		model: 'claude-fable-5-2',
		effort: 'high',
		price: { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 16 }
	}
];

const configurableRungs = new Set(['haiku', 'terra', 'sol']);

export function ladderFrom(config?: TrackerLadderConfig): TrackerModelRung[] {
	return defaultLadder.map((rung) => {
		const custom = configurableRungs.has(rung.id)
			? config?.autolaunch?.ladder?.find(
					(candidate) => candidate?.id === rung.id && candidate.model === rung.model
				)
			: undefined;
		const selected = { ...rung, ...custom, cli: rung.cli };
		return { ...selected, price: selected.price && { ...selected.price } };
	});
}

export function parseTrackerModelSpec(
	spec: string,
	ladder: readonly TrackerModelRung[]
): TrackerModelRung {
	const [name, explicitEffort, extra] = String(spec).trim().split(':');
	if (!name || extra !== undefined) throw new RangeError('expected model[:effort]');
	const effort = explicitEffort === '' ? undefined : explicitEffort;
	const alias = name.toLowerCase();
	if (alias === 'gpt-6.1-sol') throw new RangeError('use gpt-6.2-sol instead of gpt-6.1-sol');
	// The provider ID was already a valid explicit pin with Codex's xhigh default.
	if (alias === 'gpt-6.2-astra') return pinnedProviderModel(name, effort, ladder);
	return namedPin(alias, effort, ladder) ?? pinnedProviderModel(name, effort, ladder);
}

function namedPin(alias: string, effort: string | undefined, ladder: readonly TrackerModelRung[]) {
	const solXhigh = alias === 'sol-xhigh';
	const key = solXhigh ? 'sol' : alias;
	const rung = [...ladder, ...pinnedModels].find(
		(candidate) => candidate.id === key || candidate.model === key
	);
	if (!rung) return null;
	if (rung.id === 'sol' && effort && !solEfforts.includes(effort))
		throw new RangeError(`Sol effort must be ${solEfforts.join(', ')}`);
	return {
		...rung,
		effort: effort ?? (solXhigh ? 'xhigh' : rung.effort),
		price: rung.price && { ...rung.price },
		pinned: true
	};
}

function pinnedProviderModel(
	name: string,
	effort: string | undefined,
	ladder: readonly TrackerModelRung[]
): TrackerModelRung {
	const codex = /^(gpt|o\d|codex)/i.test(name);
	if (!codex && !/^claude-/.test(name))
		throw new RangeError(
			`unknown model "${name}" (use a ladder id: ${ladder.map((rung) => rung.id).join(', ')}, or a claude-*/gpt-* model id)`
		);
	return {
		id: name,
		cli: codex ? 'codex' : 'claude',
		model: name,
		effort: effort ?? (codex ? 'xhigh' : 'high'),
		price: null,
		pinned: true
	};
}
