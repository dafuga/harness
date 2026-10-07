import type { Command } from 'commander';
import { runAudit, type AuditCommandOptions } from '../workflows/runAudit';

export function registerAuditCommand(program: Command): void {
	program
		.command('audit [path]')
		.option('--coverage', 'Show adapter coverage and unknown file types.')
		.option('--profile <profile>', 'Audit profile: auto, app, dapp, or lib.', 'auto')
		.option('--json', 'Print structured audit results.')
		.option('--clean-code', 'Enable advisory Jev Clean Code review.')
		.option('--gate', 'Enable Jev review and fail on confident violations.')
		.option('--dry-run', 'Preview enabled Clean Code review without API calls.')
		.option('--refresh', 'Bypass cached Clean Code judgments.')
		.description('Audit Harness rules and optionally review Clean Code principles with Jev.')
		.action((path = '.', options: AuditCommandOptions) => runAudit(path, options));
}
