import { test } from 'vitest';
import { analyticsHtml } from '../../src/cli/program/analyticsHtml';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

const snapshot: Parameters<typeof analyticsHtml>[0] = {
	schemaVersion: 1,
	generatedAt: '2026-11-14T09:30:00.000Z',
	filters: {},
	summary: {
		events: 0,
		projects: 0,
		commands: { '</script><script>alert(1)</script>': 1 },
		loops: 0,
		completedLoops: 0,
		evaluatorOutcomes: {},
		templates: {},
		daily: {}
	},
	loops: [],
	jev: {
		response: {
			checks: 0,
			outcomes: {},
			excluded: 0,
			firstTry: { numerator: 0, denominator: 0, rate: null },
			tasks: []
		},
		cleanCode: {
			checks: 0,
			outcomes: {},
			excluded: 0,
			firstTry: { numerator: 0, denominator: 0, rate: null },
			tasks: []
		}
	},
	models: {
		authors: {},
		loopAuthors: {},
		evaluators: {},
		inputTokens: 0,
		outputTokens: 0,
		firstTryByAuthor: {},
		taskWorkers: []
	},
	tasks: {
		tasks: 0,
		executions: 0,
		submissions: 0,
		accepted: 0,
		bounces: 0,
		reviewed: 0,
		bounceRate: null,
		executionFailures: 0,
		inputTokens: null,
		outputTokens: null,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		apiCostUsd: null,
		apiCostRangeUsd: { minimum: null, maximum: null },
		unpricedExecutions: 0,
		unreportedUsage: 0,
		byModel: []
	},
	benchmarks: [],
	events: []
};

test('Renders the full analytics snapshot as safe, sectioned HTML', () => {
	const html = analyticsHtml(snapshot);
	const dataBlock =
		html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)?.[1] ?? '';
	const embeddedSnapshot = dataBlock === '' ? null : JSON.parse(dataBlock);
	const actual = {
		title: html.includes('<title>Harness Analytics</title>'),
		generatedLine: html.includes(`Generated ${snapshot.generatedAt}.`),
		fullSnapshotRoundTrip: JSON.stringify(embeddedSnapshot) === JSON.stringify(snapshot),
		escapedScriptMarkup: dataBlock.includes('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>'),
		sectionRenderer:
			html.includes("for(const section of ['summary','loops','jev','models'])") &&
			html.includes('JSON.stringify(data[section],null,2)')
	};
	const cases = [
		{
			name: 'a full snapshot with a script-like command label',
			input: snapshot,
			output: actual
		}
	];
	recordExampleCases(
		{
			unitId: 'workflow.analytics-html',
			symbol: 'analyticsHtml',
			state: 'renders-the-full-analytics-snapshot-as-safe-sectioned-html',
			evidence: 'examples-cases',
			file: 'renders-the-full-analytics-snapshot-as-safe-sectioned-html.json'
		},
		cases
	);
	expect(embeddedSnapshot).toEqual(snapshot);
	expect(actual).toEqual({
		title: true,
		generatedLine: true,
		fullSnapshotRoundTrip: true,
		escapedScriptMarkup: true,
		sectionRenderer: true
	});
});

function thrownName(input: unknown): string | undefined {
	try {
		analyticsHtml(input as Parameters<typeof analyticsHtml>[0]);
	} catch (error) {
		return error instanceof Error ? error.name : undefined;
	}
	return undefined;
}

test('Throws TypeError when the snapshot is null or serialization', () => {
	const circular: { self?: unknown } = {};
	circular.self = circular;
	const examples = [
		{ name: 'null snapshot', description: 'null', value: null },
		{ name: 'undefined snapshot', description: 'undefined', value: undefined },
		{ name: 'circular snapshot', description: 'self-referencing object', value: circular },
		{
			name: 'BigInt snapshot',
			description: 'object containing BigInt',
			value: { value: BigInt(1) }
		}
	];
	const cases = examples.map(({ name, description, value }) => ({
		name,
		input: { condition: description },
		error: { name: thrownName(value) }
	}));
	recordExampleCases(
		{
			unitId: 'workflow.analytics-html',
			symbol: 'analyticsHtml',
			state: 'throws-typeerror-when-the-snapshot-is-null-or-serialization',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-snapshot-is-null-or-serialization.json'
		},
		cases
	);
	expect(cases.map((entry) => entry.error.name)).toEqual([
		'TypeError',
		'TypeError',
		'TypeError',
		'TypeError'
	]);
});
