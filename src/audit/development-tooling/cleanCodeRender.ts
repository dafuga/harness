import type { AuditResult } from './adapters/types';
import type { CleanCodeReport, FileReview } from './cleanCodeTypes';

export function cleanCodeExitCode(result: AuditResult): number {
	if (result.cleanCode?.status === 'dry-run') return 0;
	if (result.cleanCode?.status === 'incomplete') return 2;
	if (result.findings.length > 0) return 1;
	if (
		result.cleanCode?.mode === 'gate' &&
		result.cleanCode.files.some((file) => file.status === 'violations')
	)
		return 1;
	return 0;
}

export function renderCleanCode(report: CleanCodeReport): string {
	const reviewed = report.files.filter((file) => file.status !== 'incomplete').length;
	return [
		`Clean Code review (${report.mode}): ${report.status}`,
		`Rubric: ${report.rubricVersion}; model: ${report.requestedModel}; confidence threshold: ${report.minConfidence}`,
		`Coverage: ${reviewed}/${report.coverage.selectedFiles.length} reviewed; ${report.coverage.excludedPaths.length} excluded; ${report.coverage.unsupportedFiles.length} unsupported`,
		...report.files.map(renderFileReview),
		...(report.status === 'dry-run'
			? report.coverage.selectedFiles.map((path) => `  planned: ${path}`)
			: []),
		...report.coverage.excludedPaths.map((entry) => `  excluded: ${entry.path} (${entry.reason})`),
		...report.coverage.unsupportedFiles.map((path) => `  unsupported: ${path}`),
		`API usage: ${report.usage.input_tokens} input, ${report.usage.output_tokens} output tokens`
	].join('\n');
}

function renderFileReview(file: FileReview): string {
	return [
		`${file.path}: ${file.status}${file.cached ? ' (cached)' : ''}`,
		...(file.error ? [`  ${file.error}`] : []),
		...file.assessments
			.filter((item) => item.status === 'violates' || item.status === 'needs-review')
			.map((item) => {
				const location = item.location
					? ` lines ${item.location.startLine}-${item.location.endLine}`
					: ' file-level';
				return `  [${item.principle}] ${item.status}; confidence ${item.confidence.toFixed(2)};${location}\n    ${item.guidance}`;
			}),
		...file.omittedContext.map((path) => `  omitted context: ${path}`)
	].join('\n');
}
