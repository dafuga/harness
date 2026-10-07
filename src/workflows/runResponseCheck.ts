import { resolvedContext, validateReport } from './analyticsRecord';
import { recordResponse } from './recordJevAnalytics';
import type { ResponseCheckOptions, ResponseCheckReport } from '../core/responseCheckTypes';
import {
	responseCheckSettings,
	readResponseCheckInput,
	responseInputHashes
} from './responseCheckInput';
import { responseCheckDefinitions, responseRubricVersion } from './responseCheckRubric';
import { assessResponse } from './responseCheckEvaluate';

export async function checkResponse(options: ResponseCheckOptions): Promise<ResponseCheckReport> {
	const report: ResponseCheckReport = {
		status: 'incomplete',
		mode: options.gate ? 'gate' : 'advisory',
		rubricVersion: responseRubricVersion,
		requestedModel: 'jev-1.13.0',
		minConfidence: 0.85,
		inputHashes: {},
		checks: [],
		coverage: [],
		usage: { input_tokens: 0, output_tokens: 0 }
	};
	try {
		const settings = responseCheckSettings(options);
		report.requestedModel = settings.model;
		report.minConfidence = settings.minConfidence;
		const input = await readResponseCheckInput(options);
		report.inputHashes = responseInputHashes(input);
		report.coverage = responseCheckDefinitions(input.criteria).map((item) => item.id);
		if (options.dryRun) return { ...report, status: 'dry-run' };
		return { ...report, ...(await assessResponse(input, settings)) };
	} catch (error) {
		return { ...report, error: error instanceof Error ? error.message : 'Response check failed.' };
	}
}

export function responseCheckExitCode(report: ResponseCheckReport): number {
	if (report.status === 'incomplete') return 2;
	if (report.status === 'dry-run') return 0;
	return report.mode === 'gate' && report.status !== 'satisfied' ? 1 : 0;
}

export function renderResponseCheck(report: ResponseCheckReport): string {
	return [
		`Response check: ${report.status} (${report.mode})`,
		`Model: ${report.model ?? report.requestedModel}; rubric: ${report.rubricVersion}`,
		`Confidence threshold: ${report.minConfidence}`,
		`Coverage: ${report.coverage.join(', ') || 'none'}`,
		...report.checks.map(
			(item) => `[${item.status}] ${item.title} (${item.confidence})\n  ${item.guidance}`
		),
		...(report.error ? [`Error: ${report.error}`] : []),
		'This assessment covers supplied text only; model confidence is not calibrated correctness.'
	].join('\n');
}

export async function runResponseCheck(options: ResponseCheckOptions): Promise<void> {
	const start = Date.now();
	const context = await resolvedContext(options, process.cwd());
	await validateReport(context);
	const report = await checkResponse(options);
	await recordResponse(report, context, Date.now() - start);
	console.log(options.json ? JSON.stringify(report, null, 2) : renderResponseCheck(report));
	process.exitCode = responseCheckExitCode(report);
}
