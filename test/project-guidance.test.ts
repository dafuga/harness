import { describe, expect, it } from 'vitest';
import {
	agentRules as projectAgentRules,
	skillRules as projectSkillRules
} from '../src/templates/projectGuidance';
import {
	agentRules as sessionAgentRules,
	skillRules as sessionSkillRules
} from '../src/templates/projects-sessions/projectGuidance';

const guidance = [
	{ name: 'project agent rules', text: projectAgentRules('application') },
	{ name: 'project skill rules', text: projectSkillRules('application') },
	{ name: 'session agent rules', text: sessionAgentRules('application') },
	{ name: 'session skill rules', text: sessionSkillRules('application') }
];

function hasParagraphWith(text: string, requirements: RegExp[]): boolean {
	return text
		.split(/\n\s*\n/)
		.some((paragraph) => requirements.every((rule) => rule.test(paragraph)));
}
function accountingGuidance(text: string) {
	it('preserves model, quota, usage, cost and review-retry boundaries', () => {
		expect(text).toMatch(/\bmodel\b/);
		expect(text).toMatch(/\bintelligence\b/);
		expect(text).toMatch(/\bselected\b[\s\S]{0,80}\bmodel\b/);
		expect(text).toMatch(/\breported\b[\s\S]{0,80}\bmodel\b/);
		expect(text).toMatch(/\bclaude\b[\s\S]{0,120}\bquota\b/);
		expect(text).toMatch(/\bauth(?:entication)?\b[\s\S]{0,120}\bquota\b/);
		expect(text).toMatch(/\bmodel access\b[\s\S]{0,120}\bquota\b/);
		expect(text).toMatch(/\busage\b/);
		expect(text).toMatch(/\bcost\b/);
		expect(text).toMatch(
			/(?:\bunknown\b[\s\S]{0,100}\b(?:cost|usage)\b|\b(?:cost|usage)\b[\s\S]{0,100}\bunknown\b)/
		);
		expect(text).toMatch(/\b(?:bounce|review retries?|requeue)\b/);
	});
}

for (const output of guidance) {
	describe(output.name, () => {
		const text = output.text.toLowerCase();

		it('requires contract-first CLI discovery', () => {
			expect(text).toMatch(/\bunits show\b/);
			expect(text).toMatch(/\bapi contracts get\b/);
			expect(text).toMatch(/\bvalidate\b/);
		});

		it('keeps coordinators from discovering implementation and test details', () => {
			expect(
				hasParagraphWith(text, [
					/\bcoordinators?\b/,
					/\b(?:do not|don't|must not|never|forbidden|prohibited)\b/,
					/\b(?:read|inspect|search|discover)\b/,
					/\b(?:implementation|source)\b/,
					/\btests?\b/
				])
			).toBe(true);
		});

		it('allows app-wide contract reads and restricts workers to their assigned files', () => {
			expect(
				hasParagraphWith(text, [
					/\bcontracts?\b/,
					/\b(?:read|access)\b/,
					/\b(?:app-wide|across the app)\b/
				])
			).toBe(true);
			expect(
				hasParagraphWith(text, [
					/\bimplementation workers?\b/,
					/\bassigned\b/,
					/\b(?:only|exact)\b/,
					/\bsource files?\b/
				])
			).toBe(true);
			expect(
				hasParagraphWith(text, [
					/\bverification workers?\b/,
					/\bassigned\b/,
					/\b(?:only|exact)\b/,
					/\b(?:test|verification) files?\b/
				])
			).toBe(true);
		});

		it('requires committed feature context and wanted contracts before task admission', () => {
			expect(text).toMatch(/\bwanted contracts?\b/);
			expect(text).toMatch(/\bfeature (?:context|goal|tldr)\b/);
			expect(text).toMatch(/before[\s\S]{0,120}\btask admission\b/);
			expect(text).toMatch(/\bcommit(?:ted|ting)?\b/);
		});

		accountingGuidance(text);
	});
}
