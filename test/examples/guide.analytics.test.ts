import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { analyticsGuide, reportGuide } from '../../src/guides/reports-media/analytics';

function summarise(guide: typeof analyticsGuide) {
	return {
		topic: guide.topic,
		summary: guide.summary,
		stepCount: guide.steps.length,
		ruleCount: guide.rules.length,
		antiPatternCount: guide.antiPatterns.length,
		exampleCommandCount: guide.exampleCommands.length
	};
}

test('Describes analytics guidance with its rules and commands', () => {
	const output = summarise(analyticsGuide);
	expect(output.topic).toBe('analytics');
	expect(output.summary).toBe('Durable local cross-project loop and Jev usage analytics.');
	expect(output.ruleCount).toBe(5);
	expect(analyticsGuide.rules).toContain(
		'HARNESS_ANALYTICS_HOME overrides the store; HARNESS_ANALYTICS_DISABLED=1 disables recording.'
	);
	expect(analyticsGuide.exampleCommands).toContain('harness analytics jev --json');

	recordExampleCases(
		{
			unitId: 'guide.analytics',
			symbol: 'analyticsGuide',
			state: 'describes-analytics-guidance-with-its-rules-and-commands',
			evidence: 'examples-cases',
			file: 'describes-analytics-guidance-with-its-rules-and-commands.json'
		},
		[{ name: 'analytics topic guide', input: { topic: 'analytics' }, output }]
	);
});

test('Describes report guidance and its finalize step', () => {
	const output = summarise(reportGuide);
	expect(output.topic).toBe('report');
	expect(output.stepCount).toBe(4);
	expect(reportGuide.steps[3]).toBe('Finalize a report to seal its record.');
	expect(reportGuide.rules).toContain('Reports expire after 30 days; analytics history remains.');
	expect(reportGuide.exampleCommands).toContain('harness report finalize --run RUN_ID');

	recordExampleCases(
		{
			unitId: 'guide.analytics',
			symbol: 'reportGuide',
			state: 'describes-report-guidance-and-its-finalize-step',
			evidence: 'examples-cases',
			file: 'describes-report-guidance-and-its-finalize-step.json'
		},
		[{ name: 'report topic guide', input: { topic: 'report' }, output }]
	);
});
