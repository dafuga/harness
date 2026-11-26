// @harness-uid u_jnjcxmplge
// @harness-uid u_hh0ch01c35
import type { HomeAgent } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { HomeChoice } from './hubHomeChoices.types';

/** The ask's options with the recommended one first, each keeping its own number. */
export function orderedChoices(agent: Pick<HomeAgent, 'options'>): HomeChoice[] {
	const all = (agent.options ?? []).map((option, index) => ({ number: index + 1, option }));
	return [
		...all.filter((entry) => entry.option.recommended),
		...all.filter((entry) => !entry.option.recommended)
	];
}
