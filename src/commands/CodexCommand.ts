import type { Command } from 'commander';
import { readFile, stat } from 'node:fs/promises';
import { CodexGatewayService } from '../services/CodexGatewayService';
import { registerCodexPickerCommand } from './CodexPickerCommand';

export function registerCodexCommand(program: Command): void {
	const codex = program
		.command('codex')
		.description('Local experimental Codex compatibility gateway.');
	codex
		.command('serve')
		.requiredOption(
			'--token-file <path>',
			'Owner-only file containing gateway authentication token.'
		)
		.option('--port <port>', 'Local port.', '47831')
		.action(async (options: { tokenFile: string; port: string }) => {
			const info = await stat(options.tokenFile);
			if (info.mode & 0o077) throw new Error('Token file must have owner-only permissions');
			const token = (await readFile(options.tokenFile, 'utf8')).trim();
			if (token.length < 32) throw new Error('Gateway token must contain at least 32 characters');
			const service = new CodexGatewayService({ token });
			const server = Bun.serve({
				hostname: '127.0.0.1',
				port: Number(options.port),
				idleTimeout: 255,
				fetch: (request) => service.fetch(request)
			});
			console.log(`Experimental Codex gateway listening at ${server.url}`);
		});
	registerCodexPickerCommand(codex);
}
