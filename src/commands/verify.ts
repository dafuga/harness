import { resolve } from 'node:path';
import type { Command } from 'commander';
import { parseAuditProfile } from '../audit/profile';
import { renderAudit } from '../audit/render';
import { verifyProject } from '../workflows/verifyProject';
import type { VerifyStep } from '../workflows/verifyProject';

export function registerVerifyCommand(program: Command): void {
	program
		.command('verify [path]')
		.option('--profile <profile>', 'Audit profile: auto, app, or lib.', 'auto')
		.option('--e2e', 'Run test:e2e when the project defines it.')
		.description('Run format checks, project checks, tests, build, and Harness audit.')
		.action(async (path = '.', options: { e2e?: boolean; profile?: string }) => {
			const profile = parseAuditProfile(options.profile ?? 'auto');
			const result = await verifyProject({
				e2e: Boolean(options.e2e),
				onStep: renderVerifyStep,
				profile,
				root: resolve(path)
			});

			if (result.audit) console.log(renderAudit(result.audit.findings));
			if (!result.ok) process.exitCode = result.exitCode;
		});
}

function renderVerifyStep(step: VerifyStep): void {
	console.log(`\nHarness verify: ${step.label}`);
}
