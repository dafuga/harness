import {
	nativeOpusModel,
	nativePickerProtocol,
	pickerProvider,
	type PickerData,
	type PickerRpc
} from '../utils/nativePickerProtocol';
import { NativePickerSwitchService } from './NativePickerSwitchService';
import { NativePickerDefaultsService } from './NativePickerDefaultsService';

export class NativePickerBridgeService {
	private readonly locks = new Map<string, Promise<unknown>>();
	private readonly contexts = new Map<string, PickerData>();
	private readonly switcher: NativePickerSwitchService;
	private readonly defaults: NativePickerDefaultsService;
	constructor(
		private readonly rpc: PickerRpc,
		private readonly catalogPath?: string
	) {
		this.switcher = new NativePickerSwitchService(rpc, { catalogPath });
		this.defaults = new NativePickerDefaultsService(rpc, catalogPath);
	}

	async send(method: string, params: PickerData, options?: PickerData): Promise<PickerData> {
		const id = typeof params.threadId === 'string' ? params.threadId : '';
		if (!id) return this.dispatch(method, params, options);
		const previous = this.locks.get(id) ?? Promise.resolve();
		const result = previous.catch(() => {}).then(() => this.dispatch(method, params, options));
		this.locks.set(id, result);
		try {
			return await result;
		} finally {
			if (this.locks.get(id) === result) this.locks.delete(id);
		}
	}

	private async dispatch(
		method: string,
		params: PickerData,
		options?: PickerData
	): Promise<PickerData> {
		if (method === 'config/read') return this.defaults.read(params, options);
		if (method === 'config/batchWrite') return this.defaults.write(params, options);
		if (pickerDiscoveryMethods.has(method))
			return pickerDiscovery(this.rpc, { method, params, options });
		if (method === 'thread/start' || method === 'thread/resume')
			return this.open(method, params, options);
		if (
			(method === 'thread/settings/update' || method === 'turn/start') &&
			typeof params.model === 'string'
		)
			await this.ensureProvider(params);
		const normalized =
			pickerProviderSafe(params.model) === 'harness-claude'
				? { ...params, effort: 'xhigh' }
				: params;
		return this.rpc(method, normalized, options);
	}

	private async open(
		method: string,
		params: PickerData,
		options?: PickerData
	): Promise<PickerData> {
		const previous =
			method === 'thread/resume'
				? nativePickerProtocol(
						(await this.rpc('thread/read', { threadId: params.threadId, includeTurns: false }))
							.thread
					)
				: {};
		const model = typeof params.model === 'string' ? params.model : previous.model;
		const provider = pickerProviderSafe(model) ?? params.modelProvider ?? 'openai';
		if (
			previous.modelProvider &&
			provider !== previous.modelProvider &&
			nativePickerProtocol(previous.status).type !== 'notLoaded'
		)
			throw new Error('Close this chat before resuming with a different provider');
		const config = { ...nativePickerProtocol(params.config) };
		if (provider === 'harness-claude')
			Object.assign(config, {
				model_reasoning_effort: 'xhigh',
				model_catalog_json: this.catalogPath,
				web_search: 'disabled'
			});
		const target = { ...params, model, modelProvider: provider, config };
		const result = await this.rpc(method, target, options);
		const id = nativePickerProtocol(result.thread).id;
		if (typeof id === 'string')
			this.contexts.set(id, { ...target, config: nativePickerProtocol(params.config) });
		return result;
	}

	private async ensureProvider(params: PickerData): Promise<void> {
		const state = nativePickerProtocol(
			(await this.rpc('thread/read', { threadId: params.threadId, includeTurns: false })).thread
		);
		if (state.modelProvider === pickerProvider(params.model)) return;
		const context = this.contexts.get(String(params.threadId));
		if (!context) throw new Error('Reopen this chat in the experimental client before switching');
		const resumed = await this.switcher.apply(params, context);
		this.contexts.set(String(params.threadId), {
			...context,
			model: resumed.model,
			modelProvider: resumed.modelProvider
		});
	}
}

function pickerProviderSafe(model: unknown): string | null {
	return typeof model === 'string' ? pickerProvider(model) : null;
}

const pickerDiscoveryMethods = new Set(['model/list', 'thread/list']);
async function pickerDiscovery(
	rpc: PickerRpc,
	request: { method: string; params: PickerData; options?: PickerData }
): Promise<PickerData> {
	const { method, params, options } = request;
	if (method === 'thread/list')
		return rpc(
			method,
			params.modelProviders == null
				? { ...params, modelProviders: ['openai', 'harness-claude'] }
				: params,
			options
		);
	const result = await rpc(method, params, options);
	if (!Array.isArray(result.data)) throw new Error('Invalid model discovery response');
	return {
		...result,
		data: result.data.some((item) => nativePickerProtocol(item).model === nativeOpusModel.model)
			? result.data
			: [...result.data, nativeOpusModel]
	};
}
