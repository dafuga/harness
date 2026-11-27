// @harness-uid u_rned43uh4z
import { Argument, InvalidArgumentError, type Command } from 'commander';
import type { ContainerBrowserAction } from '../../workflows/execution-runtimes/runContainerBrowser.types';
import type { ContainerBrowserCommandOptions } from './ContainerBrowserCommand.types';

const actions = ['setup', 'up', 'status', 'down', 'open', 'viewer', 'approve', 'revoke'];

/** `harness container-browser`: a full browser in a local container, for sites that block headless. */
export class ContainerBrowserCommand {
	register(program: Command): void {
		program
			.command('container-browser')
			.description('Run a private browser in a local container.')
			.addArgument(new Argument('<action>').choices(actions))
			.argument('[value]', 'The pairing code for approve, or the address for open.')
			.requiredOption('--profile <name>', 'Saved sign-in profile, one per site.')
			.option('--port <number>', 'Viewer port on loopback.', number, 6080)
			.option('--host <name...>', 'Names and addresses the viewer is opened by.')
			.option('--access-host <name>', 'HTTPS hostname protected by Cloudflare Access.')
			.option('--access-team <name>', 'Cloudflare Access team name.')
			.option('--access-audience <id>', 'Cloudflare Access application audience.')
			.option('--access-email <email>', 'Only this Access identity can pair a remote device.')
			.option('--disk-image <file>', 'Pre-downloaded Colima VM image for the first start.')
			.option('--download-kbps <number>', 'Download cap for the image build.', number, 10_000)
			.option('--directory <path>', 'State directory (default ~/.harness/container-browser/…).')
			.action(
				async (
					action: ContainerBrowserAction,
					value: string | undefined,
					options: ContainerBrowserCommandOptions
				) => {
					const { runContainerBrowser } =
						await import('../../workflows/execution-runtimes/runContainerBrowser');
					process.exitCode = await runContainerBrowser({ ...options, action, value });
				}
			);
	}
}

function number(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000)
		throw new InvalidArgumentError('Use a positive whole number.');
	return parsed;
}
