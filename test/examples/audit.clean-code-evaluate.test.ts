import type { Answer, Review, Evaluation } from './audit.clean-code-evaluate.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { evaluateCleanCodeFile } from '../../src/audit/development-tooling/cleanCodeEvaluate';
import { JevModelMismatchError } from '../../src/audit/development-tooling/cleanCodeEvaluate.types';
import type { JevEvaluator, EvaluationInput } from '../../src/audit/development-tooling/cleanCodeEvaluate.types';

const MODEL = 'jev-1.13.0';
const TARGET_HASH = '9c2e4f7a1b6d03e8f5a2c9d14b7e60f3a8c5d12e9b4f70a6c3d8e1f5b2a9c047';
const CONTEXT_HASH = '5d07a3c9e1f48b26d0a7c35e9f1b842ad6c0e7f3b95a1d28c4e6f0a7b3d91e5c';
const MEETS = {
	type: 'choice',
	choice: 'meets',
	confidence: 0.9,
	probabilities: { meets: 0.9, violates: 0.04, not_applicable: 0.02, insufficient_context: 0.04 }
} as unknown as Answer;

/** A fake Jev that answers every question "meets" and records each request state. */
function fakeEvaluator(returnedModel: string, requests: string[]): JevEvaluator {
	return async (request) => {
		requests.push(request.state);
		const answers = Object.fromEntries(Object.keys(request.questions).map((id) => [id, MEETS]));
		return { model: returnedModel, answers, usage: { input_tokens: 100, output_tokens: 20 } };
	};
}

function reviewInput(root: string, model: string, evaluate: JevEvaluator): EvaluationInput {
	return {
		root,
		snapshot: {
			target: {
				path: 'src/example.ts',
				contents: 'export const total = 1;\n',
				hash: TARGET_HASH
			},
			inputs: [],
			contextHash: CONTEXT_HASH,
			state: 'example-review-state',
			contextPaths: ['AGENTS.md'],
			omittedContext: []
		},
		settings: {
			mode: 'gate',
			model,
			minConfidence: 0.5,
			apiKeyEnv: 'EXAMPLE_JEV_KEY',
			exclude: []
		} as unknown as EvaluationInput['settings'],
		options: {},
		evaluate
	};
}

function summarize(review: Review) {
	return {
		path: review.path,
		status: review.status,
		cached: review.cached,
		model: review.model,
		usage: review.usage,
		assessmentStatuses: review.assessments.map((item) => item.status)
	};
}

async function rejectionOf(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('Expected the review to reject.');
}

test('Reviews a clean file and reuses the stored evaluation', async () => {
	const cases = await withTempDir('clean-code-evaluate-', async (root) => {
		const requests: string[] = [];
		const usages: Evaluation['usage'][] = [];
		const first = {
			...reviewInput(root, MODEL, fakeEvaluator(MODEL, requests)),
			onUsage: (usage: Evaluation['usage']) => {
				usages.push(usage);
			}
		};
		const fresh = await evaluateCleanCodeFile(first);
		const reused = await evaluateCleanCodeFile(
			reviewInput(root, MODEL, fakeEvaluator(MODEL, requests))
		);
		expect(fresh.cached).toBe(false);
		expect(fresh.status).toBe('clean');
		expect(reused.cached).toBe(true);
		expect(reused.usage).toEqual(fresh.usage);
		expect(requests).toHaveLength(1);
		expect(usages).toEqual([{ input_tokens: 100, output_tokens: 20 }]);
		return [
			{
				name: 'fresh review of a clean file',
				input: { path: 'src/example.ts', model: MODEL },
				output: summarize(fresh)
			},
			{
				name: 'second review reuses the stored evaluation',
				input: { path: 'src/example.ts', model: MODEL },
				output: summarize(reused)
			}
		];
	});
	recordExampleCases(
		{
			unitId: 'audit.clean-code-evaluate',
			symbol: 'evaluateCleanCodeFile',
			state: 'reviews-a-clean-file-and-reuses-the-stored-evaluation',
			evidence: 'examples-cases',
			file: 'reviews-a-clean-file-and-reuses-the-stored-evaluation.json'
		},
		cases
	);
});

test('Rejects a Jev response that names a different model', async () => {
	const error = await withTempDir('clean-code-evaluate-', (root) =>
		rejectionOf(() =>
			evaluateCleanCodeFile(reviewInput(root, MODEL, fakeEvaluator('jev-other', [])))
		)
	);
	expect(error).toBeInstanceOf(JevModelMismatchError);
	expect(error.message).toBe('Jev returned an unexpected model.');
	recordExampleCases(
		{
			unitId: 'audit.clean-code-evaluate',
			symbol: 'evaluateCleanCodeFile',
			state: 'rejects-a-jev-response-that-names-a-different-model',
			evidence: 'examples-cases',
			file: 'rejects-a-jev-response-that-names-a-different-model.json'
		},
		[
			{
				name: 'requested jev-1.13.0 but Jev returned jev-other',
				input: { model: MODEL, returnedModel: 'jev-other' },
				error: { name: error.name, message: error.message }
			}
		]
	);
});

test('Skips the model check and cache for jev-latest', async () => {
	const cases = await withTempDir('clean-code-evaluate-', async (root) => {
		const requests: string[] = [];
		const first = await evaluateCleanCodeFile(
			reviewInput(root, 'jev-latest', fakeEvaluator(MODEL, requests))
		);
		const second = await evaluateCleanCodeFile(
			reviewInput(root, 'jev-latest', fakeEvaluator(MODEL, requests))
		);
		expect(first.model).toBe(MODEL);
		expect(first.cached).toBe(false);
		expect(second.cached).toBe(false);
		expect(requests).toHaveLength(2);
		return [
			{
				name: 'jev-latest accepts the model Jev returns',
				input: { model: 'jev-latest', returnedModel: MODEL },
				output: summarize(first)
			}
		];
	});
	recordExampleCases(
		{
			unitId: 'audit.clean-code-evaluate',
			symbol: 'evaluateCleanCodeFile',
			state: 'skips-the-model-check-and-cache-for-jev-latest',
			evidence: 'examples-cases',
			file: 'skips-the-model-check-and-cache-for-jev-latest.json'
		},
		cases
	);
});
