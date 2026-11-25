// @harness-uid u_qsjzwebg6r
import type { Command } from 'commander';
import { deployOperation, type DeployOptions } from '../../workflows/execution-runtimes/runDeploy';

export class DeployCommand {
	register(program: Command): void {
		const deploy = program
			.command('deploy [project] [environment]')
			.description('Prepare and deploy one project release with reviewed Docker scripts.')
			.option('--registry <path>', 'Owner-only deployment registry.')
			.option('--ref <sha>', 'Pinned source revision for staging.')
			.option('--release <id>', 'Prepared immutable release ID.')
			.option('--from <run>', 'Signed predecessor deployment run.')
			.option('--plan', 'Inspect live parity without provider changes.')
			.option(
				'--publish-plan',
				'Show a read-only plan for this release in the native deploy inbox.'
			)
			.option('--wait-for-go', 'Publish this exact run and wait for native owner approval and Go.')
			.action((project: string, environment: string, options: DeployOptions) =>
				deployOperation({ kind: 'deploy', project, environment }, options)
			);
		deploy
			.command('prepare <project>')
			.description('Build and test a credential-free release artifact.')
			.action((project: string, _options: DeployOptions, command: Command) =>
				deployOperation({ kind: 'prepare', project }, command.optsWithGlobals())
			);
		deploy
			.command('status <run>')
			.option('--scope', 'Return the exact data digest for a reviewer to sign.')
			.action((run: string, _options: DeployOptions, command: Command) =>
				deployOperation({ kind: 'status', run }, command.optsWithGlobals())
			);
		registerReceipts(deploy);
		registerRollback(deploy);
	}
}

function registerRollback(deploy: Command): void {
	deploy
		.command('rollback <project> <environment>')
		.requiredOption('--run <id>')
		.description('Restore the recorded previous route through the same approval gate.')
		.action((project: string, environment: string, options: { run: string }, command: Command) =>
			deployOperation(
				{ kind: 'rollback', project, environment, run: options.run },
				command.optsWithGlobals()
			)
		);
}

function registerReceipts(deploy: Command): void {
	deploy
		.command('signoff <run>')
		.requiredOption('--receipt <path>')
		.action((run: string, _options: DeployOptions, command: Command) =>
			deployOperation({ kind: 'signoff', run }, command.optsWithGlobals())
		);
	deploy
		.command('resume <run>')
		.description('Reconcile an interrupted run without submitting another write.')
		.action((run: string, _options: DeployOptions, command: Command) =>
			deployOperation({ kind: 'resume', run }, command.optsWithGlobals())
		);
}
