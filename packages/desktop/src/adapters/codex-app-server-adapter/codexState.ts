import type { CliCommand } from "../../models/AgentRunner.types.ts";
import type { ProviderState } from "../../models/Desktop.types.ts";
import { cliProcess } from "../../utils/cliProcess";
import { codexRpc } from "../../utils/codex-rpc/codexRpc";
import { providerModels } from "./providerModels";

export async function codexState(command: CliCommand, server: CliCommand): Promise<ProviderState> {
	const base: ProviderState = {
		id: 'codex',
		label: 'Codex CLI',
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
		const rpc = await codexRpc(server);
		try {
			const account = await rpc.request<{ account: { type: string } | null }>('account/read', {
				refreshToken: false
			});
			if (account.account?.type !== 'chatgpt')
				throw new Error('Sign in to Codex CLI with a ChatGPT subscription.');
			const models = await rpc.request<{ data: Parameters<typeof providerModels>[0] }>(
				'model/list',
				{ limit: 100 }
			);
			const capability = await rpc.request<{ imageGeneration: boolean }>(
				'modelProvider/capabilities/read',
				{}
			);
			return {
				...base,
				available: true,
				models: providerModels(models.data),
				imageGeneration: capability.imageGeneration
			};
		} finally {
			rpc.dispose();
		}
	} catch (error) {
		return { ...base, reason: error instanceof Error ? error.message : 'Codex CLI unavailable.' };
	}
}
