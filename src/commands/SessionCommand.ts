import type { Command } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { installSessionHook, type SessionInstallOptions } from '../workflows/installSessionHook';
import { runSessionHook, type SessionRunOptions } from '../workflows/runSessionHook';

export class SessionCommand {
	async run(options: SessionRunOptions): Promise<void> {
		console.log(JSON.stringify(await runSessionHook(await Bun.stdin.text(), options)));
	}
}

export function registerSessionCommand(program: Command): void {
	const session = program
		.command('session')
		.description('Automatic local Codex Clean Code checks.');
	session
		.command('hook')
		.requiredOption('--settings <path>', 'Private session-check settings file.')
		.option('--dry-run', 'Preview eligible files without contacting Jev.')
		.option('--refresh', 'Bypass cached judgments.')
		.description('Handle a Codex SessionStart event from stdin.')
		.action((options: SessionRunOptions) => new SessionCommand().run(options));
	session
		.command('install')
		.option('--home <path>', 'Codex configuration directory.', join(homedir(), '.codex'))
		.requiredOption('--root <paths...>', 'Allowed project roots or parent directories.')
		.requiredOption('--credential-file <path>', 'Owner-only Harness Jev credential file.')
		.requiredOption('--bundle <path>', 'Built Harness CLI bundle to install.')
		.description('Install an idempotent background hook; Codex trust review is still required.')
		.action(async (options: SessionInstallOptions) => {
			console.log(JSON.stringify(await installSessionHook(options)));
		});
}
