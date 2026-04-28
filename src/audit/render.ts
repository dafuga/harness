import type { AuditFinding } from './audit';

export function renderAudit(findings: AuditFinding[]): string {
	if (findings.length === 0) {
		return 'Frame audit passed. Files and functions are staying small.';
	}

	return findings
		.map((finding) => `${finding.path} [${finding.rule}]\n  ${finding.message}`)
		.join('\n\n');
}
