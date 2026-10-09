import {
	nativePickerProtocol,
	pickerProvider,
	type PickerData,
	type PickerRpc
} from '../utils/nativePickerProtocol';
import { NativePickerIdleValidator } from '../validators/NativePickerIdleValidator';

/** Only used by the experimental desktop copy, never the running vendor client. */
export class NativePickerSwitchService {
	constructor(
		private readonly rpc: PickerRpc,
		private readonly options: { timeoutMs?: number; catalogPath?: string } = {}
	) {}

	async apply(params: PickerData, context: PickerData = {}): Promise<PickerData> {
		const threadId = params.threadId;
		if (typeof threadId !== 'string') throw new Error('Missing thread ID');
		const previous = nativePickerProtocol(
			(await this.rpc('thread/read', { threadId, includeTurns: false })).thread
		);
		const idle = await new NativePickerIdleValidator().validate(previous, this.rpc);
		if (!idle.valid) throw new Error(idle.errors[0]);
		if (previous.ephemeral === true)
			throw new Error('Provider switching requires persisted history');
		const remote = await this.rpc('remoteControl/status/read', {});
		if (remote.status !== 'disabled')
			throw new Error('Close remote clients and disable remote control before switching');
		await this.rpc('thread/unsubscribe', { threadId });
		await this.waitClosed(threadId);
		const provider = pickerProvider(params.model);
		const effort =
			provider === 'harness-claude' ? 'xhigh' : (params.effort ?? previous.reasoningEffort);
		const target = this.target(params, previous, context);
		try {
			const resumed = await this.rpc('thread/resume', target);
			await this.verify(threadId, target.model, provider, effort);
			return resumed;
		} catch (error) {
			await this.rollback(previous, context);
			throw new Error(`Provider switch failed; previous settings restored. ${String(error)}`);
		}
	}

	private target(params: PickerData, previous: PickerData, context: PickerData): PickerData {
		const provider = pickerProvider(params.model);
		const config = {
			...nativePickerProtocol(context.config),
			model_reasoning_effort:
				provider === 'harness-claude' ? 'xhigh' : (params.effort ?? previous.reasoningEffort)
		};
		if (provider === 'harness-claude')
			Object.assign(config, {
				model_catalog_json: this.options.catalogPath,
				web_search: 'disabled'
			});
		return {
			...context,
			threadId: params.threadId,
			cwd: previous.cwd,
			model: params.model,
			modelProvider: provider,
			config
		};
	}

	private async waitClosed(threadId: string): Promise<void> {
		const deadline = Date.now() + (this.options.timeoutMs ?? 10_000);
		do {
			const result = await this.rpc('thread/loaded/list', { limit: 10000 });
			if (result.nextCursor != null) throw new Error('Cannot verify every loaded chat');
			if (Array.isArray(result.data) && !result.data.includes(threadId)) return;
			if (Date.now() >= deadline) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		} while (Date.now() < deadline);
		throw new Error('Chat has not closed on every client; provider unchanged');
	}

	private async verify(
		threadId: string,
		model: unknown,
		provider: unknown,
		effort: unknown
	): Promise<void> {
		const result = nativePickerProtocol(
			(await this.rpc('thread/read', { threadId, includeTurns: false })).thread
		);
		if (
			result.model !== model ||
			result.modelProvider !== provider ||
			result.reasoningEffort !== effort
		)
			throw new Error('Resumed provider, model or effort did not match');
	}

	private async rollback(previous: PickerData, context: PickerData): Promise<void> {
		const threadId = String(previous.id);
		try {
			await this.rpc('thread/unsubscribe', { threadId });
			await this.waitClosed(threadId);
			await this.rpc(
				'thread/resume',
				this.target(
					{ threadId, model: previous.model, effort: previous.reasoningEffort },
					previous,
					context
				)
			);
			await this.verify(threadId, previous.model, previous.modelProvider, previous.reasoningEffort);
		} catch {
			throw new Error(
				'Provider switch failed and rollback could not be verified; manual recovery required'
			);
		}
	}
}
