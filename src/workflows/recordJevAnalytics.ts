import type { ResponseCheckReport } from '../core/responseCheckTypes';
import type { CleanCodeReport } from '../audit/cleanCodeTypes';
import type { AnalyticsContext } from '../core/analyticsTypes';
import { fingerprint, recordAnalytics } from './analyticsRecord';
export async function recordResponse(
	report: ResponseCheckReport,
	context: AnalyticsContext,
	durationMs: number
): Promise<void> {
	await recordAnalytics({
		...context,
		kind: 'jev',
		action: 'assessed',
		checkType: 'response',
		status: report.status,
		durationMs,
		requestedModel: report.requestedModel,
		evaluatorModel: report.model,
		fingerprint: fingerprint([
			report.inputHashes,
			report.requestedModel,
			report.rubricVersion,
			report.minConfidence
		]),
		inputTokens: report.usage.input_tokens,
		outputTokens: report.usage.output_tokens
	});
}
export async function recordCleanCode(
	report: CleanCodeReport,
	context: AnalyticsContext,
	timing: { root: string; durationMs: number }
): Promise<void> {
	await recordAnalytics(
		{
			...context,
			kind: 'jev',
			action: 'assessed',
			checkType: 'clean-code',
			status: report.status,
			durationMs: timing.durationMs,
			requestedModel: report.requestedModel,
			evaluatorModel:
				[...new Set(report.files.map((file) => file.model).filter(Boolean))].join(',') || undefined,
			cached: report.files.length > 0 && report.files.every((file) => file.cached),
			fingerprint: fingerprint([
				report.files.map((file) => [file.path, file.contentHash, file.contextHash]),
				report.requestedModel,
				report.rubricVersion,
				report.minConfidence
			]),
			inputTokens: report.usage.input_tokens,
			outputTokens: report.usage.output_tokens
		},
		timing.root
	);
}
