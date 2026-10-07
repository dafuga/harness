import type { AnalyticsContext } from '../core/analyticsTypes';
import { resolvedContext, validateReport } from './analyticsRecord';
import { recordCleanCode } from './recordJevAnalytics';
import { resolve } from 'node:path';
import { auditProject } from '../audit/audit';
import { parseAuditProfile } from '../audit/profile';
import { renderAudit, renderAuditCoverage } from '../audit/render';
import { cleanCodeExitCode, renderCleanCode } from '../audit/cleanCodeRender';

export interface AuditCommandOptions extends AnalyticsContext {
	profile?: string;
	coverage?: boolean;
	json?: boolean;
	cleanCode?: boolean;
	gate?: boolean;
	dryRun?: boolean;
	refresh?: boolean;
}

export async function runAudit(path: string, options: AuditCommandOptions): Promise<void> {
	const start = Date.now();
	const context = await resolvedContext(options, resolve(path));
	await validateReport(context);
	const result = await auditProject(resolve(path), {
		profile: parseAuditProfile(options.profile ?? 'auto'),
		cleanCode: {
			enabled: options.cleanCode,
			gate: options.gate,
			dryRun: options.dryRun,
			refresh: options.refresh
		}
	});
	if (result.cleanCode)
		await recordCleanCode(result.cleanCode, context, {
			root: resolve(path),
			durationMs: Date.now() - start
		});
	const text = options.coverage ? renderAuditCoverage(result) : renderAudit(result.findings);
	const semantic = result.cleanCode ? `\n\n${renderCleanCode(result.cleanCode)}` : '';
	console.log(options.json ? JSON.stringify(result, null, 2) : text + semantic);
	process.exitCode = cleanCodeExitCode(result);
}
