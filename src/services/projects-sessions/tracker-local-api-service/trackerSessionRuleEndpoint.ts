// @harness-uid u_wqffa5k52u
import {
	TrackerSessionRuleRepository,
	trackerRuleFields,
	trackerRuleSkill,
	trackerRuleText
} from '../../../repositories/projects-sessions/TrackerSessionRuleRepository';
import { TrackerItemReadError } from '../../../repositories/projects-sessions/tracker-item-read-repository/TrackerItemReadError';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { readItemBody } from './trackerLocalItemMutation';
import { trackerResponse } from './trackerLocalResponse';

export async function trackerSessionRuleEndpoint(
	request: Request,
	dependencies: TrackerLocalApiDependencies,
	actor: string | null
): Promise<Response> {
	const { store, items } = dependencies;
	const rules = new TrackerSessionRuleRepository(store.database);
	if (request.method === 'GET') return listRules(request, rules);
	if (request.method !== 'POST') return trackerResponse(405, { error: 'method not allowed' });
	const input = (await readItemBody(request)) as Record<string, unknown>;
	const skill = input.skill;
	const text = typeof input.text === 'string' ? input.text.trim() : input.text;
	const from = input.from;
	if (
		typeof from !== 'string' ||
		!from ||
		typeof skill !== 'string' ||
		!trackerRuleSkill(skill) ||
		typeof text !== 'string' ||
		!trackerRuleText(text)
	)
		throw new TrackerItemReadError(
			'supply an incident, a skill name and a single-line rule of up to 500 characters without credentials or private paths'
		);
	request.signal.throwIfAborted();
	const { incident, existing } = store.commitLocal(() => {
		const incident = items.resolve(from).id;
		const existing = rules
			.list(skill)
			.find((rule) => rule.incident === incident && rule.text === text);
		return {
			result: { incident, existing },
			operation: existing
				? undefined
				: { itemId: incident, actor, fields: trackerRuleFields({ skill, text }) }
		};
	});
	const rule =
		existing ?? rules.list(skill).find((rule) => rule.incident === incident && rule.text === text);
	return trackerResponse(existing ? 200 : 201, rule);
}

function listRules(request: Request, rules: TrackerSessionRuleRepository): Response {
	const query = new URL(request.url).searchParams;
	const skill = query.get('skill');
	const limit = Number(query.get('limit') ?? Number.MAX_SAFE_INTEGER);
	if ((skill !== null && !trackerRuleSkill(skill)) || !Number.isSafeInteger(limit) || limit < 1)
		return trackerResponse(400, { error: 'supply a valid skill name or a positive limit' });
	return trackerResponse(200, rules.list(skill ?? undefined).slice(0, limit));
}
