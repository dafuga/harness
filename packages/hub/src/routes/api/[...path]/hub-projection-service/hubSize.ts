import type { HubSourceContext } from '../../../../utils/development-tooling/hubSource';

export function hubSize(context: HubSourceContext, paths: string[]) {
	const entries = paths.map((path) => context.entries.find((e) => e.path === path));
	const available = entries.length > 0 && entries.every((e) => Number.isSafeInteger(e?.size));
	const bytes = entries.reduce((total, e) => total + (e?.size ?? 0), 0);
	if (!paths.length) return { available, text: 'Not measured: design only' };
	return {
		available,
		text: available ? (bytes / 1024).toFixed(1) + ' KB' : 'Not measured: source size unavailable'
	};
}
