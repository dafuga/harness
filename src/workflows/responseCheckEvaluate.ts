import { JevAdapter } from '../adapters/JevAdapter';
import type { JevChoice, JevEvaluation, JevRequest } from '../core/jevTypes';
import type {
	ResponseAssessment,
	ResponseCheckInput,
	ResponseCheckReport,
	ResponseCheckSettings
} from '../core/responseCheckTypes';
import {
	responseCheckDefinitions,
	responseCheckQuestions,
	type ResponseCheckDefinition
} from './responseCheckRubric';

type Evaluate = (request: JevRequest) => Promise<JevEvaluation>;

export async function assessResponse(
	input: ResponseCheckInput,
	settings: ResponseCheckSettings,
	evaluate?: Evaluate
): Promise<Pick<ResponseCheckReport, 'checks' | 'status' | 'model' | 'usage'>> {
	const definitions = responseCheckDefinitions(input.criteria);
	if (!input.response.trim()) return emptyResponse(definitions);
	const run = evaluate ?? credentialedEvaluator(settings);
	const result = await run({
		state: JSON.stringify(input),
		questions: responseCheckQuestions(definitions)
	});
	const checks = definitions.map((item) =>
		assessment(item, result.answers[item.id], settings.minConfidence)
	);
	return { checks, status: responseStatus(checks), model: result.model, usage: result.usage };
}

export function responseStatus(checks: ResponseAssessment[]): ResponseCheckReport['status'] {
	if (checks.some((item) => item.status === 'violates')) return 'violations';
	if (checks.some((item) => item.status === 'needs-review')) return 'needs-review';
	return 'satisfied';
}

function assessment(
	item: ResponseCheckDefinition,
	answer: JevChoice,
	threshold: number
): ResponseAssessment {
	const uncertain = answer.confidence < threshold || answer.choice === 'insufficient_context';
	return {
		...answer,
		id: item.id,
		title: item.title,
		guidance: item.guidance,
		status: uncertain ? 'needs-review' : decisiveStatus(answer)
	};
}

function credentialedEvaluator(settings: ResponseCheckSettings): Evaluate {
	const apiKey = process.env[settings.apiKeyEnv];
	if (!apiKey?.trim())
		throw new Error('Missing project-owned JEV credential in the selected environment variable.');
	const adapter = new JevAdapter({ apiKey, model: settings.model });
	return (request) => adapter.evaluate(request);
}

function emptyResponse(
	definitions: ResponseCheckDefinition[]
): Pick<ResponseCheckReport, 'checks' | 'status' | 'usage'> {
	const checks = definitions.map((item) =>
		assessment(
			item,
			{
				type: 'choice',
				choice: item.id === 'fulfillment' ? 'violates' : 'insufficient_context',
				confidence: 1,
				probabilities: {
					meets: 0,
					violates: item.id === 'fulfillment' ? 1 : 0,
					insufficient_context: item.id === 'fulfillment' ? 0 : 1
				}
			},
			0.85
		)
	);
	return { checks, status: 'violations', usage: { input_tokens: 0, output_tokens: 0 } };
}

function decisiveStatus(answer: JevChoice): 'meets' | 'violates' {
	return answer.choice === 'meets' ? 'meets' : 'violates';
}
