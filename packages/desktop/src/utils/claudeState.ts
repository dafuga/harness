import type { CliCommand } from '../models/AgentRunner.types';
import type { ProviderState } from '../models/Desktop.types';
import { cliProcess } from './cliProcess';
export async function claudeState(command: CliCommand): Promise<ProviderState> {
	const base: ProviderState = {
		id: 'claude',
		label: 'Claude CLI',
		available: false,
		reason: null,
		version: null,
		imageGeneration: false,
		models: []
	};
	try {
		base.version = (
			await cliProcess({ ...command, args: [...command.args, '--version'] }, { timeoutMs: 10000 })
		).trim();
		const auth = JSON.parse(
			await cliProcess(
				{ ...command, args: [...command.args, 'auth', 'status', '--json'] },
				{ timeoutMs: 10000 }
			)
		) as { loggedIn: boolean; authMethod?: string };
		if (!auth.loggedIn || auth.authMethod !== 'claude.ai')
			throw new Error('Sign in to Claude CLI with a subscription.');
		return {
			...base,
			available: true,
			models: [
				{
					id: 'claude-opus-5-5',
					label: 'Claude Opus 5.5',
					efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
					defaultEffort: 'xhigh',
					isDefault: true
				}
			]
		};
	} catch (error) {
		return { ...base, reason: error instanceof Error ? error.message : 'Claude CLI unavailable.' };
	}
}
