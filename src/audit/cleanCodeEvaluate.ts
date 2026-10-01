import { CleanCodeResponseValidator } from '../validators/CleanCodeResponseValidator';
import { recordValue } from '../validators/cleanCodeValue';
import { assessCleanCode, fileReviewStatus } from './cleanCodeAssessment';
import {
	readReviewCache,
	reviewCacheKey,
	writeReviewCache,
	type CachedEvaluation
} from './cleanCodeCache';
import { reviewInputsCurrent } from './cleanCodeFiles';
import { applyReviewLocations, planReviewLocations } from './cleanCodeLocations';
import { cleanCodeQuestions } from './cleanCodeRubric';
import type { ReviewSnapshot } from './cleanCodeSnapshot';
import type {
	CleanCodeOptions,
	CleanCodeSettings,
	FileReview,
	JevEvaluation,
	JevRequest,
	JevUsage
} from './cleanCodeTypes';

export type JevEvaluator = (request: JevRequest, signal?: AbortSignal) => Promise<JevEvaluation>;

interface EvaluationInput {
	root: string;
	snapshot: ReviewSnapshot;
	settings: CleanCodeSettings;
	options: CleanCodeOptions;
	evaluate: JevEvaluator;
	onUsage?: (usage: JevUsage) => void;
}

export async function evaluateCleanCodeFile(input: EvaluationInput): Promise<FileReview> {
	const key = reviewCacheKey(input.snapshot, input.settings);
	const cacheAllowed = !['jev-latest', 'jev-preview'].includes(input.settings.model);
	const cached =
		cacheAllowed && !input.options.refresh ? await validatedCache(input, key) : undefined;
	const value = cached ?? (await evaluateSnapshot(input));
	const assessments = assessCleanCode(value.evaluation, input.settings.minConfidence);
	const plan = planReviewLocations(input.snapshot.target.contents, assessments);
	applyReviewLocations(assessments, plan, value.localization, input.settings.minConfidence);
	if (!(await reviewInputsCurrent(input.root, input.snapshot.inputs)))
		throw new Error('Source or supplied context changed during review; result discarded.');
	if (cacheAllowed && !cached) await writeReviewCache(input.root, key, value);
	return {
		path: input.snapshot.target.path,
		contentHash: input.snapshot.target.hash,
		contextHash: input.snapshot.contextHash,
		status: fileReviewStatus(assessments),
		assessments,
		contextPaths: input.snapshot.contextPaths,
		omittedContext: input.snapshot.omittedContext,
		model: value.evaluation.model,
		cached: Boolean(cached),
		usage: evaluationUsage(value)
	};
}

async function evaluateSnapshot(input: EvaluationInput): Promise<CachedEvaluation> {
	const validator = new CleanCodeResponseValidator();
	const questions = cleanCodeQuestions();
	const raw = await input.evaluate(
		{ state: input.snapshot.state, questions },
		input.options.signal
	);
	const evaluation = validator.validate(raw, questions);
	input.onUsage?.(evaluation.usage);
	assertModel(evaluation, input.settings.model);
	const assessments = assessCleanCode(evaluation, input.settings.minConfidence);
	const plan = planReviewLocations(input.snapshot.target.contents, assessments);
	if (Object.keys(plan.questions).length === 0) return { evaluation };
	const state = JSON.stringify({ target: input.snapshot.target.path, spans: plan.spans });
	const locationRaw = await input.evaluate(
		{ state, questions: plan.questions },
		input.options.signal
	);
	const localization = validator.validate(locationRaw, plan.questions);
	input.onUsage?.(localization.usage);
	if (localization.model !== evaluation.model)
		throw new Error('Jev model changed during localization.');
	return { evaluation, localization };
}

async function validatedCache(
	input: EvaluationInput,
	key: string
): Promise<CachedEvaluation | undefined> {
	try {
		const raw = recordValue(await readReviewCache(input.root, key));
		const validator = new CleanCodeResponseValidator();
		const evaluation = validator.validate(raw.evaluation, cleanCodeQuestions());
		assertModel(evaluation, input.settings.model);
		const plan = planReviewLocations(
			input.snapshot.target.contents,
			assessCleanCode(evaluation, input.settings.minConfidence)
		);
		const localization = Object.keys(plan.questions).length
			? validator.validate(raw.localization, plan.questions)
			: undefined;
		if (localization && localization.model !== evaluation.model) return undefined;
		return { evaluation, localization };
	} catch {
		return undefined;
	}
}

function assertModel(result: JevEvaluation, model: string): void {
	if (!['jev-latest', 'jev-preview'].includes(model) && result.model !== model)
		throw new Error('Jev returned an unexpected model.');
}

function evaluationUsage(value: CachedEvaluation): JevEvaluation['usage'] {
	return {
		input_tokens:
			value.evaluation.usage.input_tokens + (value.localization?.usage.input_tokens ?? 0),
		output_tokens:
			value.evaluation.usage.output_tokens + (value.localization?.usage.output_tokens ?? 0)
	};
}
