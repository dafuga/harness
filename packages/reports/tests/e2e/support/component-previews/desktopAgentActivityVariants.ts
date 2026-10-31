import type { DesktopData } from './desktopData.svelte';

/** Deterministic responses at the existing, typed activity bridge; no external registrations. */
export function desktopAgentActivityVariant(data: DesktopData, variant: string): void {
	if (variant === 'historical') data.workspace.pinned = true;
	if (variant === 'unavailable' || variant === 'agents-unknown') {
		delete data.bridge.agentActivity;
		return;
	}
	if (variant === 'loading') {
		data.bridge.agentActivity = () => new Promise(() => {});
		return;
	}
	const original = data.bridge.agentActivity!;
	let reads = 0;
	data.bridge.agentActivity = async (...args) => {
		if (variant === 'refresh-error' && reads++ > 0) throw new Error('Synthetic refresh failure.');
		return reading(await original(...args), variant);
	};
}
function reading(
	value: Awaited<ReturnType<NonNullable<DesktopData['bridge']['agentActivity']>>>,
	variant: string
) {
	const empty = ['empty', 'agents-empty', 'never-used'].includes(variant);
	const stale = ['stale', 'agents-stale'].includes(variant);
	const many = ['many', 'agents-many'].includes(variant);
	let roster = empty ? [] : value.agents.roster;
	if (stale) roster = roster.map((agent) => ({ ...agent, expiresAt: '2020-01-01T00:00:00Z' }));
	if (many)
		roster = Array.from({ length: 8 }, (_, index) => ({
			...roster[0],
			id: `preview-agent-${index}`,
			label: `Preview agent ${index + 1}`,
			task: `Capture component group ${index + 1}`
		}));
	let working = value.agents.working;
	if (empty) working = 0;
	if (many) working = 8;
	if (variant === 'never-used') working = null;
	return {
		...value,
		sampledAt: variant === 'stale-reading' ? '2020-01-01T00:00:00Z' : value.sampledAt,
		agents: {
			...value.agents,
			tracking: variant === 'never-used' ? ('never-used' as const) : value.agents.tracking,
			working,
			unreadable: variant === 'unreadable' ? 1 : 0,
			roster
		}
	};
}
