// @harness-uid u_r7qgepnoax
import type { TrackerSessionRule } from '../../../repositories/projects-sessions/TrackerSessionRuleRepository.types';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';
import { nativeTrackerQuery as query } from './nativeTrackerRunRequest';

export function nativeTrackerRuleRequest(
	[verb, ...words]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest {
	if (verb === 'list' && !words.length && !values.from)
		return { method: 'GET', path: '/rules' + query({ skill: values.skill, limit: values.limit }) };
	if (verb === 'add' && words.length && values.from && values.skill && !values.limit)
		return {
			method: 'POST',
			path: '/rules',
			body: { from: values.from, skill: values.skill, text: words.join(' ') }
		};
	throw new TypeError(
		'usage: tracker rule add "<rule>" --from <incident> --skill <name> | tracker rule list [--skill <name>] [--limit <count>]'
	);
}

export function formatNativeTrackerRules(data: TrackerSessionRule | TrackerSessionRule[]): string {
	const rules = Array.isArray(data) ? data : [data];
	return (
		rules
			.map(({ at, incident, skill, text }) => `${at} [${incident}] ${skill}: ${text}`)
			.join('\n') || '(no session rules)'
	);
}
