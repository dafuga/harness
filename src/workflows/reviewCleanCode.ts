import { resolve } from 'node:path';
import { JevAdapter } from '../adapters/JevAdapter';
import { collectAuditedFiles } from '../audit/collect';
import { discoverCleanCodeFiles } from '../audit/cleanCodeDiscovery';
import { reportReviewStatus } from '../audit/cleanCodeAssessment';
import { evaluateCleanCodeFile, type JevEvaluator } from '../audit/cleanCodeEvaluate';
import { reviewInputsCurrent } from '../audit/cleanCodeFiles';
import { cleanCodeRubricVersion } from '../audit/cleanCodeRubric';
import { snapshotCleanCodeFile, type ReviewSnapshot } from '../audit/cleanCodeSnapshot';
import type {
	CleanCodeOptions,
	CleanCodeReport,
	CleanCodeSettings,
	FileReview,
	JevUsage
} from '../audit/cleanCodeTypes';
import type { AuditFinding } from '../audit/types';

export interface ReviewCleanCodeInput {
	root: string;
	settings: CleanCodeSettings;
	options?: CleanCodeOptions;
	findings?: AuditFinding[];
	evaluate?: JevEvaluator;
}

interface ReviewedEntry {
	result: FileReview;
	snapshot?: ReviewSnapshot;
}

export async function reviewCleanCode(input: ReviewCleanCodeInput): Promise<CleanCodeReport> {
	const root = resolve(input.root);
	const coverage = discoverCleanCodeFiles(
		root,
		await collectAuditedFiles(root),
		input.settings.exclude
	);
	const report: CleanCodeReport = {
		mode: input.settings.mode,
		status: 'not-applicable',
		rubricVersion: cleanCodeRubricVersion,
		requestedModel: input.settings.model,
		minConfidence: input.settings.minConfidence,
		coverage,
		files: [],
		usage: { input_tokens: 0, output_tokens: 0 }
	};
	if (input.options?.dryRun) return { ...report, status: 'dry-run' };
	const entries: ReviewedEntry[] = [];
	const evaluate = input.evaluate ?? lazyEvaluator(input.settings);
	for (const path of coverage.selectedFiles) {
		entries.push(await reviewEntry({ ...input, root, evaluate }, path, coverage.selectedFiles));
	}
	for (const entry of entries) {
		if (entry.snapshot && !(await reviewInputsCurrent(root, entry.snapshot.inputs))) {
			entry.result.status = 'incomplete';
			entry.result.assessments = [];
			entry.result.error = 'Source or supplied context changed before the review completed.';
		}
	}
	report.files = entries.map((entry) => entry.result);
	report.status = reportReviewStatus(report.files);
	report.usage = report.files
		.filter((file) => !file.cached)
		.reduce(
			(usage, file) => ({
				input_tokens: usage.input_tokens + file.usage.input_tokens,
				output_tokens: usage.output_tokens + file.usage.output_tokens
			}),
			report.usage
		);
	return report;
}

async function reviewEntry(
	input: ReviewCleanCodeInput & { evaluate: JevEvaluator },
	path: string,
	files: string[]
): Promise<ReviewedEntry> {
	let snapshot: ReviewSnapshot | undefined;
	const usage = { input_tokens: 0, output_tokens: 0 };
	try {
		if (input.options?.signal?.aborted) throw new Error('Jev review was cancelled.');
		snapshot = await snapshotCleanCodeFile({
			root: input.root,
			path,
			files,
			findings: input.findings ?? []
		});
		const result = await evaluateCleanCodeFile({
			root: input.root,
			snapshot,
			settings: input.settings,
			options: input.options ?? {},
			evaluate: input.evaluate,
			onUsage: (value) => {
				usage.input_tokens += value.input_tokens;
				usage.output_tokens += value.output_tokens;
			}
		});
		return { result, snapshot };
	} catch (error) {
		return { snapshot, result: incompleteReview(path, error, snapshot, usage) };
	}
}

function incompleteReview(
	path: string,
	error: unknown,
	snapshot: ReviewSnapshot | undefined,
	usage: JevUsage
): FileReview {
	return {
		path,
		contentHash: snapshot?.target.hash ?? '',
		contextHash: snapshot?.contextHash ?? '',
		status: 'incomplete',
		assessments: [],
		contextPaths: snapshot?.contextPaths ?? [],
		omittedContext: snapshot?.omittedContext ?? [],
		cached: false,
		usage,
		error: error instanceof Error ? error.message : 'Review could not complete.'
	};
}

function lazyEvaluator(settings: CleanCodeSettings): JevEvaluator {
	let adapter: JevAdapter | undefined;
	let failure: Error | undefined;
	return async (request, signal) => {
		if (failure) throw failure;
		try {
			const apiKey = process.env[settings.apiKeyEnv];
			if (!apiKey)
				throw new Error(
					`Set ${settings.apiKeyEnv} to a dedicated credential for this project before reviewing.`
				);
			adapter ??= new JevAdapter({ apiKey, model: settings.model });
			return await adapter.evaluate(request, signal);
		} catch (error) {
			failure = error instanceof Error ? error : new Error('Jev request failed.');
			throw failure;
		}
	};
}
