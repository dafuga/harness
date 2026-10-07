import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditConfig, AuditIgnore } from './adapters/types';
import type { AuditFinding } from './types';
import { fail } from '../core/errors';
import { harnessRuleLimits, type HarnessRuleLimits } from '../rules/catalog';
import { resolveCleanCodeSettings } from './cleanCodeConfig';
import type { CleanCodeSettings } from './cleanCodeTypes';

const configFile = 'harness.audit.json';
const limitKeys = Object.keys(harnessRuleLimits) as Array<keyof HarnessRuleLimits>;

export interface ResolvedAuditConfig {
	cleanCode: CleanCodeSettings;
	ignore: AuditIgnore[];
	limits: HarnessRuleLimits;
}

export function readAuditConfig(root: string): ResolvedAuditConfig {
	const path = join(root, configFile);
	if (!existsSync(path)) return normalizeConfig({});
	return normalizeConfig(JSON.parse(readFileSync(path, 'utf8')) as AuditConfig);
}

export function filterIgnoredFindings(
	findings: AuditFinding[],
	config: ResolvedAuditConfig
): { activeFindings: AuditFinding[]; ignoredFindings: AuditFinding[] } {
	const ignoredFindings = findings.filter((finding) => isIgnoredFinding(finding, config.ignore));
	return {
		activeFindings: findings.filter((finding) => !ignoredFindings.includes(finding)),
		ignoredFindings
	};
}

function normalizeConfig(config: AuditConfig): ResolvedAuditConfig {
	return {
		cleanCode: resolveCleanCodeSettings(config.cleanCode),
		ignore: (config.ignore ?? []).filter((item) => item.path.trim().length > 0),
		limits: normalizeLimits(config.limits ?? {})
	};
}

function normalizeLimits(limits: Partial<HarnessRuleLimits>): HarnessRuleLimits {
	return Object.fromEntries(
		limitKeys.map((key) => [key, normalizeLimit(key, limits[key])])
	) as unknown as HarnessRuleLimits;
}

function normalizeLimit(key: keyof HarnessRuleLimits, value: number | undefined): number {
	if (value === undefined) return harnessRuleLimits[key];
	if (Number.isInteger(value) && value > 0) return value;
	return fail(`harness.audit.json limits.${key} must be a positive integer.`);
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
