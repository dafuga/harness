// @harness-uid u_53bgisvajn
import { Argument, InvalidArgumentError, type Command } from 'commander';
import type { XDigestAction, XDigestCommandOptions } from './XDigestCommand.types';

/**
 * `harness x-digest`: `collect` reads the feeds on the browser's computer; `send` posts the result
 * from the computer that can read the Slack token. No token ever moves between the two.
 */
export class XDigestCommand {
	register(program: Command): void {
		program
			.command('x-digest')
			.description('Send a read-only X digest.')
			.addArgument(
				new Argument('[action]').choices(['collect', 'send', 'identity']).default('collect')
			)
			.requiredOption('--config <file>', 'JSON config for this side; it holds no credentials.')
			.option('--state <file>', 'State file (default under ~/.harness/x-digest).')
			.option('--dry-run', 'collect: report counts without queueing or asking anything.')
			.option('--force', 'collect: queue again even if today’s digest was already queued.')
			.option('--wait <minutes>', 'Wait for a free viewer (60) or today’s file (90).', minutes)
			.action(run);
	}
}

async function run(action: XDigestAction, options: XDigestCommandOptions): Promise<void> {
	if (action === 'collect') {
		const { runXDigest } = await import('../../workflows/agents-providers/runXDigest');
		process.exitCode = await runXDigest({ ...options, wait: options.wait ?? 60 });
		return;
	}
	const sender = await import('../../workflows/agents-providers/runXDigestSend');
	process.exitCode =
		action === 'identity'
			? await sender.printSlackIdentity(options.config)
			: await sender.runXDigestSend({ ...options, wait: options.wait ?? 90 });
}

function minutes(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 600)
		throw new InvalidArgumentError('Use a whole number of minutes from 0 to 600.');
	return parsed;
}
