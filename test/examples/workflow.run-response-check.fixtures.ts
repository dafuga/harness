import type { Captured } from './workflow.run-response-check.test.types';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { runResponseCheck } from '../../src/cli/program/runResponseCheck';
import type {
	ResponseAssessment,
	ResponseCheckOptions,
	ResponseCheckReport
} from '../../src/core/verification-evidence/responseCheckTypes';

export const unit = 'workflow.run-response-check';

export const requestText =
	'Summarise the release notes in three bullet points for the support team.';

export const responseText =
	'- Adds response checks\n- Fixes report IDs\n- Documents the exit codes';

export const criteriaText =
	'[{"id":"cite-sources","description":"Cite a source for each factual claim."}]';

export const credential = 'HARNESS_RESPONSE_CHECK_TEST_KEY';

export const standardIds = ['fulfillment', 'completeness', 'constraints', 'relevance'];

const disclaimer =
	'This assessment covers supplied text only; model confidence is not calibrated correctness.';

const texts: Record<string, string> = {
	fulfillment:
		'Answer the actual user request rather than a different task or a promise to do it later.',
	completeness: 'Include each requested deliverable and address every requested part.',
	constraints: 'Follow the user’s explicit constraints and requested output format.',
	relevance: 'Keep the answer focused on material that helps fulfill the request.',
	'custom:cite-sources': 'Revise the answer to satisfy acceptance criterion cite-sources.'
};

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** A check as the evaluator returns it: the chosen label carries the confidence, the rest share the remainder. */
function assessed(
	id: string,
	title: string,
	status: ResponseAssessment['status'],
	confidence: number
): ResponseAssessment {
	const choice = status === 'needs-review' ? 'insufficient_context' : status;
	const rest = Math.round(((1 - confidence) / 2) * 100) / 100;
	const probabilities = {
		meets: rest,
		violates: rest,
		insufficient_context: rest,
		[choice]: confidence
	};
	return {
		type: 'choice',
		choice,
		confidence,
		probabilities,
		id,
		title,
		status,
		guidance: texts[id]
	};
}

const base: ResponseCheckReport = {
	status: 'satisfied',
	mode: 'advisory',
	rubricVersion: 'response-check-v1',
	requestedModel: 'jev-1.13.0',
	model: 'jev-1.13.0',
	minConfidence: 0.85,
	inputHashes: {},
	checks: [],
	coverage: [],
	usage: { input_tokens: 1512, output_tokens: 296 }
};

export const reportOf = (overrides: Partial<ResponseCheckReport>): ResponseCheckReport => ({
	...base,
	...overrides
});

export const violations = reportOf({
	status: 'violations',
	mode: 'gate',
	minConfidence: 0.9,
	coverage: [...standardIds, 'custom:cite-sources'],
	checks: [
		assessed('fulfillment', 'Task fulfillment', 'meets', 0.96),
		assessed('completeness', 'Completeness', 'violates', 0.94),
		assessed('constraints', 'Explicit constraints', 'meets', 0.92),
		assessed('relevance', 'Relevance', 'meets', 0.97),
		assessed('custom:cite-sources', 'Acceptance criterion: cite-sources', 'needs-review', 0.62)
	]
});

export const incomplete = reportOf({
	status: 'incomplete',
	model: undefined,
	usage: { input_tokens: 0, output_tokens: 0 },
	error: '--request and --response files are required.'
});

export const violationsText = `Response check: violations (gate)\nModel: jev-1.13.0; rubric: response-check-v1\nConfidence threshold: 0.9\nCoverage: fulfillment, completeness, constraints, relevance, custom:cite-sources\n[meets] Task fulfillment (0.96)\n  ${texts.fulfillment}\n[violates] Completeness (0.94)\n  ${texts.completeness}\n[meets] Explicit constraints (0.92)\n  ${texts.constraints}\n[meets] Relevance (0.97)\n  ${texts.relevance}\n[needs-review] Acceptance criterion: cite-sources (0.62)\n  ${texts['custom:cite-sources']}\n${disclaimer}`;

export const incompleteText = `Response check: incomplete (advisory)\nModel: jev-1.13.0; rubric: response-check-v1\nConfidence threshold: 0.85\nCoverage: none\nError: --request and --response files are required.\n${disclaimer}`;

export function writeFiles(directory: string, files: Record<string, string>): void {
	for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
}

/** Options as a caller passes them: each file named in the spec is a file in the temporary directory. */
export function toOptions(spec: ResponseCheckOptions, directory: string): ResponseCheckOptions {
	const at = (name?: string) => (name === undefined ? undefined : join(directory, name));
	return {
		...spec,
		request: at(spec.request),
		response: at(spec.response),
		context: at(spec.context),
		criteria: at(spec.criteria)
	};
}

export async function withEnv<T>(
	values: Record<string, string>,
	use: () => Promise<T>
): Promise<T> {
	for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
	try {
		return await use();
	} finally {
		vi.unstubAllEnvs();
	}
}

/** Runs the command with console output captured. Analytics fields are blank so the caller's HARNESS_ANALYTICS_* values do not apply. */
async function runCaptured(directory: string, spec: ResponseCheckOptions): Promise<Captured> {
	const lines: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((line: string) => {
		lines.push(line);
	});
	const previous = process.exitCode;
	process.exitCode = undefined;
	try {
		await runResponseCheck({
			loop: '',
			step: '',
			task: '',
			report: '',
			...toOptions(spec, directory)
		});
		return { printed: lines.join('\n'), exitCode: process.exitCode };
	} catch (error) {
		const failure = error as Error;
		const message = failure.message.split(directory).join('<reports-home>');
		return {
			printed: lines.join('\n'),
			exitCode: process.exitCode,
			error: { name: failure.name, message }
		};
	} finally {
		log.mockRestore();
		process.exitCode = previous;
	}
}

/** Runs the commands one after another: the console and the exit code are shared, so runs cannot overlap. */
export async function runInOrder(
	directory: string,
	inputs: ResponseCheckOptions[]
): Promise<Captured[]> {
	const done: Captured[] = [];
	for (const input of inputs) done.push(await runCaptured(directory, input));
	return done;
}
