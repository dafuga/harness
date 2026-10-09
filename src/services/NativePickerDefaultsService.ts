import {
	nativePickerProtocol,
	pickerProvider,
	type PickerData,
	type PickerRpc
} from '../utils/nativePickerProtocol';

/** Copy-local, in-memory preferences; the original OpenAI config remains authoritative on launch. */
export class NativePickerDefaultsService {
	private readonly edits = new Map<string, unknown>();
	constructor(
		private readonly rpc: PickerRpc,
		private readonly catalogPath?: string
	) {}

	async write(params: PickerData, options?: PickerData): Promise<PickerData> {
		if (!Array.isArray(params.edits)) throw new Error('Invalid configuration edits');
		const modelEdits = params.edits.filter((edit) => this.isModelEdit(edit));
		const remaining = params.edits.filter((edit) => !this.isModelEdit(edit));
		for (const edit of modelEdits) {
			const value = nativePickerProtocol(edit);
			if (String(value.keyPath).endsWith('model') && value.value != null)
				pickerProvider(value.value);
		}
		const result = await this.rpc('config/batchWrite', { ...params, edits: remaining }, options);
		for (const edit of modelEdits) {
			const value = nativePickerProtocol(edit);
			this.edits.set(String(value.keyPath), value.value);
		}
		return result;
	}

	async read(params: PickerData, options?: PickerData): Promise<PickerData> {
		const result = await this.rpc('config/read', params, options);
		const config = globalThis.structuredClone(nativePickerProtocol(result.config));
		for (const [key, value] of this.edits) this.assign(config, key, value);
		if (this.edits.has('model') && typeof config.model === 'string') {
			config.model_provider = pickerProvider(config.model);
			if (config.model_provider === 'harness-claude') {
				config.model_reasoning_effort = 'xhigh';
				config.model_catalog_json = this.catalogPath;
				config.web_search = 'disabled';
			}
		}
		return { ...result, config };
	}

	private isModelEdit(edit: unknown): boolean {
		const path = nativePickerProtocol(edit).keyPath;
		return (
			typeof path === 'string' && /^(?:profiles\.[\w-]+\.)?model(?:_reasoning_effort)?$/u.test(path)
		);
	}

	private assign(config: PickerData, key: string, value: unknown): void {
		const parts = key.split('.');
		let current = config;
		for (const part of parts.slice(0, -1)) {
			const next = nativePickerProtocol(current[part]);
			current[part] = next;
			current = next;
		}
		current[parts.at(-1)!] = value;
	}
}
