import { resolve } from 'node:path';
import { Command } from 'commander';
import { auditPath } from '../audit/audit';
import { renderAudit } from '../audit/render';

export function registerAuditCommand(program: Command): void {
	program
		.command('audit [path]')
		.description('Audit files for Frame size and responsibility rules.')
		.action(async (path = '.') => {
			const findings = await auditPath(resolve(path));
			console.log(renderAudit(findings));
			if (findings.length > 0) {
				process.exitCode = 1;
			}
		});
}
