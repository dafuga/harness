import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditConfig, AuditIgnore } from './adapters/types';
import type { AuditFinding } from './types';

const configFile = 'harness.audit.json';

export function readAuditConfig(root: string): AuditConfig {
	const path = join(root, configFile);
	if (!existsSync(path)) return {};
	return normalizeConfig(JSON.parse(readFileSync(path, 'utf8')) as AuditConfig);
}

export function filterIgnoredFindings(
	findings: AuditFinding[],
	config: AuditConfig
): { activeFindings: AuditFinding[]; ignoredFindings: AuditFinding[] } {
	const ignoredFindings = findings.filter((finding) =>
		isIgnoredFinding(finding, config.ignore ?? [])
	);
	return {
		activeFindings: findings.filter((finding) => !ignoredFindings.includes(finding)),
		ignoredFindings
	};
}

function normalizeConfig(config: AuditConfig): AuditConfig {
	return { ignore: (config.ignore ?? []).filter((item) => item.path.trim().length > 0) };
}

function isIgnoredFinding(finding: AuditFinding, ignores: AuditIgnore[]): boolean {
	return ignores.some(
		(ignore) => pathMatches(finding.path, ignore.path) && ruleMatches(finding, ignore)
	);
}

function pathMatches(path: string, pattern: string): boolean {
	if (pattern.endsWith('/')) return path.startsWith(pattern);
	return path === pattern;
}

function ruleMatches(finding: AuditFinding, ignore: AuditIgnore): boolean {
	return !ignore.rule || finding.rule === ignore.rule;
}
