import type { AuditFinding, AuditResult } from './audit';

export function renderAudit(findings: AuditFinding[]): string {
	if (findings.length === 0) {
		return 'Harness audit passed. Files and functions are staying small.';
	}

	return findings
		.map((finding) => `${finding.path} [${finding.rule}]\n  ${finding.message}`)
		.join('\n\n');
}

export function renderAuditCoverage(result: AuditResult): string {
	return [
		renderAudit(result.findings),
		'',
		`Harness audit coverage (${result.coverage.profile} profile)`,
		renderAdapterCoverage(result),
		renderCoverageList('Unknown files', result.coverage.unknownFiles),
		renderCoverageList('Ignored paths', result.coverage.ignoredPaths)
	]
		.filter(Boolean)
		.join('\n');
}

function renderAdapterCoverage(result: AuditResult): string {
	const lines = result.coverage.adapters.map((adapter) => {
		const tools =
			adapter.optionalTools.length > 0 ? ` tools: ${adapter.optionalTools.join(', ')}` : '';
		return `- ${adapter.id}: ${adapter.files.length} files (${adapter.extensions.join(', ')})${tools}`;
	});

	return ['Covered adapters:', ...lines].join('\n');
}

function renderCoverageList(title: string, values: string[]): string {
	if (values.length === 0) return `${title}: none`;
	return [`${title}:`, ...values.map((value) => `- ${value}`)].join('\n');
}
