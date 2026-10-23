import type { TaskCheck } from './planAudit.types';
export type { TaskCheck } from './planAudit.types';

const sections = [
	['overview', /overview|objective|scope|goal/i],
	['acceptance', /acceptance|success criteria/i],
	['dependencies', /dependencies/i],
	['verification', /verification|testing|validation/i],
	['performance', /performance/i]
] as const;

/** Structural heuristics expose omissions; they do not prove semantic fulfillment. */
export function planAudit(proposal: string, goal: string): TaskCheck[] {
	const found = new Map<string, string>();
	for (const section of proposal.split(/^#{1,6}\s+/m).slice(1)) {
		const [title, ...body] = section.split('\n');
		for (const [id, pattern] of sections)
			if (pattern.test(title)) found.set(id, body.join('\n').trim());
	}
	const checks: TaskCheck[] = sections.map(([id]) => ({
		id: `plan.${id}`,
		passed: (found.get(id)?.length ?? 0) >= 12,
		detail: `Provide a substantive ${id} section, including an explicit explanation when none applies.`
	}));
	checks.push({
		id: 'plan.acceptance-items',
		passed: /^\s*[-*]\s+\S/m.test(found.get('acceptance') ?? ''),
		detail: 'List individually assessable acceptance criteria.'
	});
	checks.push({
		id: 'plan.placeholders',
		passed: !/^\s*(?:[-*]\s+)?(?:TODO|TBD|FIXME|Describe the user-facing outcome)\b/im.test(
			proposal
		),
		detail: 'Replace unfinished template content before completing the plan.'
	});
	const performance = found.get('performance') ?? '';
	checks.push({
		id: 'plan.performance-method',
		passed:
			/workload|representative|scenario/i.test(performance) &&
			/latency|timing|response time/i.test(performance) &&
			/memory|rss/i.test(performance),
		detail:
			'Name representative workloads, latency and memory measurements; do not invent runtime results for planned code.'
	});
	checks.push({
		id: 'plan.request',
		passed: addressesRequest(proposal, goal),
		detail:
			'The proposal must address the stated request; this word-overlap heuristic still needs human review.'
	});
	return checks;
}

function addressesRequest(proposal: string, goal: string): boolean {
	const words = goal.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
	const relevant = words.filter(
		(word) =>
			!['please', 'should', 'could', 'would', 'with', 'that', 'this', 'task', 'plan'].includes(word)
	);
	return (
		goal.trim().length > 0 &&
		(relevant.length === 0 || relevant.some((word) => proposal.toLowerCase().includes(word)))
	);
}
