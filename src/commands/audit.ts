import { resolve } from 'node:path';
import type { Command } from 'commander';
import { auditProject } from '../audit/audit';
import { renderAudit, renderAuditCoverage } from '../audit/render';
import { fail } from '../core/errors';
import type { AuditProfile } from '../audit/adapters/types';

export function registerAuditCommand(program: Command): void {
	program
		.command('audit [path]')
		.option('--coverage', 'Show adapter coverage and unknown file types.')
		.option('--profile <profile>', 'Audit profile: auto, app, or lib.', 'auto')
		.description('Audit files for Frame size and responsibility rules.')
		.action(async (path = '.', options: { coverage?: boolean; profile?: string }) => {
			const profile = parseProfile(options.profile ?? 'auto');
			const result = await auditProject(resolve(path), { profile });
			console.log(options.coverage ? renderAuditCoverage(result) : renderAudit(result.findings));
			if (result.findings.length > 0) {
				process.exitCode = 1;
			}
		});
}

function parseProfile(profile: string): AuditProfile {
	if (profile === 'app' || profile === 'auto' || profile === 'lib') return profile;
	return fail(`Unsupported audit profile "${profile}". Use one of: auto, app, lib.`);
}
