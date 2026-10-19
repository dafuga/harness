import type { ExplorerEvidence } from '../../../models/Explorer.types.ts';

/**
 * What the parent of a selected commit declared for an entity and the commit no longer does:
 * a whole scenario, or single states of one that stays. Each is a sentence, so what a commit
 * removed is seen as gone beside what it kept, with a result before and none after. The host's
 * typed coverage of both sides says what each declared; nothing is worked out from captures.
 */
export function entityRemoved(evidence: ExplorerEvidence): string[] {
	const now = evidence.after.coverage;
	return (evidence.before?.coverage ?? []).flatMap((was) => {
		const kept = now.find((item) => item.scenario === was.scenario);
		const states = was.states.map((state) => state.state);
		if (!kept) return [`${was.title}: the scenario, with its states ${states.join(', ')}.`];
		return states
			.filter((state) => !kept.states.some((item) => item.state === state))
			.map((state) => `${was.title}: the state ${state}.`);
	});
}
