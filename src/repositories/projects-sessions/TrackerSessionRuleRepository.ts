// @harness-uid u_yj6etxhn2o
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { trackerClockMilliseconds } from '../../utils/projects-sessions/nextTrackerClock';
import { sanitizeTrackerText } from '../../utils/projects-sessions/sanitizeTrackerText';
import type { TrackerSessionRule } from './TrackerSessionRuleRepository.types';
import { trackerSessionRuleSeeds } from './tracker-session-rule-repository/trackerSessionRuleSeeds';

const ruleField = 'session_rule_v1';
const rulePath = `$.${ruleField}`;
const trackerSessionRulePredicate = `json_type(fields, '${rulePath}') = 'object'`;
export const trackerRecentRuleCount = 5;

export class TrackerSessionRuleRepository {
	constructor(private readonly database: SqliteDatabase) {}

	list(skill?: string): TrackerSessionRule[] {
		const rows = this.database
			.prepare(
				`SELECT hlc, item_id AS incident, json_extract(fields, '${rulePath}.skill') AS skill,
					json_extract(fields, '${rulePath}.text') AS text
				FROM ops WHERE ${trackerSessionRulePredicate} ORDER BY hlc DESC, op_id DESC`
			)
			.all() as { hlc: string; incident: string; skill: unknown; text: unknown }[];
		const rules = rows
			.filter((row) => trackerRuleSkill(row.skill) && trackerRuleText(row.text))
			.map(({ hlc, incident, skill, text }) => ({
				at: new Date(trackerClockMilliseconds(hlc)).toISOString(),
				incident,
				skill: String(skill),
				text: String(text)
			}));
		const unique = new Map<string, TrackerSessionRule>();
		for (const rule of [...rules, ...trackerSessionRuleSeeds]) {
			const key = ruleKey(rule);
			if ((!skill || rule.skill === skill) && !unique.has(key)) unique.set(key, rule);
		}
		return [...unique.values()].sort((a, b) => b.at.localeCompare(a.at));
	}
}

export function trackerRuleFields({ skill, text }: Pick<TrackerSessionRule, 'skill' | 'text'>) {
	return {
		[ruleField]: { skill, text },
		'note+': `Session rule (${skill}): ${text}`
	};
}

export function trackerRuleSkill(value: unknown): value is string {
	return (
		typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64
	);
}

export function trackerRuleText(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= 500 &&
		!/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value) &&
		sanitizeTrackerText(value) === value
	);
}

function ruleKey({ incident, skill, text }: TrackerSessionRule): string {
	return JSON.stringify([incident, skill, text]);
}
