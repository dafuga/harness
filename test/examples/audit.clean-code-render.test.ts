import { covered, meta, report, noUsage, dryRunReport } from './audit.clean-code-render.fixture';
import type { Case } from './audit.clean-code-render.test.types';
import { test } from 'vitest';
import {
	cleanCodeExitCode,
	renderCleanCode
} from '../../src/audit/development-tooling/cleanCodeRender';
import type { AuditResult } from '../../src/audit/development-tooling/adapters/types';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import type {
	CleanCodeReport,
	FileReview,
	PrincipleAssessment,
	ReviewLocation
} from '../../src/audit/development-tooling/cleanCodeTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const base = { unitId: 'audit.clean-code-render', evidence: 'examples-cases' };
const rubricLine = 'Rubric: clean-code-v1; model: jev-1.13.0; confidence threshold: 0.85';
const usage = { input_tokens: 9120, output_tokens: 734 };
const incompleteUsage = { input_tokens: 4870, output_tokens: 512 };
const coverage: AuditResult['coverage'] = {
	profile: 'app',
	adapters: [
		{
			id: 'typescript',
			label: 'TypeScript and JavaScript',
			extensions: ['.ts', '.tsx', '.js', '.jsx'],
			optionalTools: ['eslint'],
			files: [covered]
		}
	],
	coveredFiles: [covered],
	ignoredPaths: ['dist/', 'node_modules/'],
	ignoredFindings: [],
	unknownFiles: []
};
const finding: AuditFinding = {
	path: 'src/audit/development-tooling/reportLines.ts',
	rule: 'function-name-pattern',
	message: 'Function "format_line" should use camelCase.'
};
const rubric: Record<string, [string, string]> = {
	'meaningful-names': [
		'Meaningful names',
		'Name identifiers after their domain purpose; retain conventional framework and short local names when clear.'
	],
	'focused-functions': [
		'Focused functions',
		'Extract independent tasks into clearly named functions without fragmenting an already coherent operation.'
	]
};

/** A principle verdict as the review stores it; a confidence under the threshold needs review. */
function assessment(
	principle: string,
	choice: 'meets' | 'violates',
	confidence: number,
	location?: ReviewLocation
): PrincipleAssessment {
	const [title, guidance] = rubric[principle];
	const status = confidence < meta.minConfidence ? 'needs-review' : choice;
	return {
		type: 'choice',
		choice,
		confidence,
		probabilities: { [choice]: confidence },
		principle,
		title,
		guidance,
		status,
		location
	};
}

const fileBase = {
	path: covered,
	contentHash: '6f1c0a92b7d3',
	contextHash: '2e9a7c4f0b31',
	contextPaths: ['AGENTS.md', 'harness.audit.json'],
	omittedContext: [],
	model: 'jev-1.13.0',
	cached: false,
	usage
};
const violatingFile: FileReview = {
	...fileBase,
	status: 'violations',
	assessments: [
		assessment('meaningful-names', 'meets', 0.93),
		assessment('focused-functions', 'violates', 0.88)
	]
};
const incompleteFile: FileReview = {
	...fileBase,
	status: 'incomplete',
	assessments: [],
	usage: incompleteUsage,
	error: 'Source or supplied context changed before the review completed.'
};
const cachedFile: FileReview = {
	...fileBase,
	status: 'needs-review',
	cached: true,
	omittedContext: ['docs/architecture.md'],
	assessments: [
		assessment('focused-functions', 'violates', 0.62, {
			startLine: 40,
			endLine: 52,
			excerpt: 'export function renderFileReview(file: FileReview): string {'
		})
	]
};
const gateReport = report('gate', 'violations', [violatingFile], usage);
const incompleteReport = report('advisory', 'incomplete', [incompleteFile], incompleteUsage);
const cachedReport = report('advisory', 'needs-review', [cachedFile], noUsage);

function auditWith(cleanCode?: CleanCodeReport, findings: AuditFinding[] = []): AuditResult {
	return { findings, coverage, cleanCode };
}
const staticFinding = auditWith(undefined, [finding]);
const dryRunWithFinding = auditWith(dryRunReport, [finding]);
const advisoryViolation = auditWith({ ...gateReport, mode: 'advisory' });
const gateNeedsReview = auditWith({ ...cachedReport, mode: 'gate' });
const gateViolation = auditWith(gateReport);
const incompleteAdvisory = auditWith(incompleteReport);
const incompleteWithFinding = auditWith(incompleteReport, [finding]);

const gateText = [
	'Clean Code review (gate): violations',
	rubricLine,
	'Coverage: 1/1 reviewed; 0 excluded; 0 unsupported',
	`${covered}: violations`,
	'  [focused-functions] violates; confidence 0.88; file-level',
	'    Extract independent tasks into clearly named functions without fragmenting an already coherent operation.',
	'API usage: 9120 input, 734 output tokens'
].join('\n');
const dryRunText = [
	'Clean Code review (advisory): dry-run',
	rubricLine,
	'Coverage: 0/2 reviewed; 1 excluded; 1 unsupported',
	'  planned: src/audit/cleanCodeRender.ts',
	`  planned: ${covered}`,
	'  excluded: dist/ (Artifact directory or symlink)',
	'  unsupported: package.json',
	'API usage: 0 input, 0 output tokens'
].join('\n');
const incompleteText = [
	'Clean Code review (advisory): incomplete',
	rubricLine,
	'Coverage: 0/1 reviewed; 0 excluded; 0 unsupported',
	`${covered}: incomplete`,
	'  Source or supplied context changed before the review completed.',
	'API usage: 4870 input, 512 output tokens'
].join('\n');
const cachedText = [
	'Clean Code review (advisory): needs-review',
	rubricLine,
	'Coverage: 1/1 reviewed; 0 excluded; 0 unsupported',
	`${covered}: needs-review (cached)`,
	'  [focused-functions] needs-review; confidence 0.62; lines 40-52',
	'    Extract independent tasks into clearly named functions without fragmenting an already coherent operation.',
	'  omitted context: docs/architecture.md',
	'API usage: 0 input, 0 output tokens'
].join('\n');

/** Calls the real export with one input and keeps the input and the value it returned. */
function called<I, O>(name: string, input: I, call: (value: I) => O): Case {
	return { name, input, output: call(input) };
}

test('Exit code is 0 when nothing blocks the run', () => {
	const state = 'exit-code-is-0-when-nothing-blocks-the-run';
	const cases = [
		called('a clean audit with no clean-code review', auditWith(), cleanCodeExitCode),
		called('a dry run that also has a static finding', dryRunWithFinding, cleanCodeExitCode),
		called('an advisory review with a violating file', advisoryViolation, cleanCodeExitCode),
		called('a gate review that only needs review', gateNeedsReview, cleanCodeExitCode)
	];
	const outputs = cases.map((item) => item.output);
	expect(outputs).toEqual([0, 0, 0, 0]);
	recordExampleCases({ ...base, symbol: 'cleanCodeExitCode', state, file: `${state}.json` }, cases);
});

test('Exit code is 1 or 2 when the run is blocked', () => {
	const state = 'exit-code-is-1-or-2-when-the-run-is-blocked';
	const cases = [
		called('a static finding with no clean-code review', staticFinding, cleanCodeExitCode),
		called('a gate review with a violating file', gateViolation, cleanCodeExitCode),
		called('an advisory review that could not complete', incompleteAdvisory, cleanCodeExitCode),
		called('an incomplete review with a finding', incompleteWithFinding, cleanCodeExitCode)
	];
	const outputs = cases.map((item) => item.output);
	expect(outputs).toEqual([1, 1, 2, 2]);
	recordExampleCases({ ...base, symbol: 'cleanCodeExitCode', state, file: `${state}.json` }, cases);
});

test('Renders the clean-code summary for each review status', () => {
	const state = 'renders-the-clean-code-summary-for-each-review-status';
	const cases = [
		called('a gate review with a violating file', gateReport, renderCleanCode),
		called('an advisory dry run that plans two files', dryRunReport, renderCleanCode),
		called('an advisory review that could not complete', incompleteReport, renderCleanCode),
		called('a cached review with a line range and omitted context', cachedReport, renderCleanCode)
	];
	const outputs = cases.map((item) => item.output);
	expect(outputs).toEqual([gateText, dryRunText, incompleteText, cachedText]);
	recordExampleCases({ ...base, symbol: 'renderCleanCode', state, file: `${state}.json` }, cases);
});
