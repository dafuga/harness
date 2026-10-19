import { App } from '@modelcontextprotocol/ext-apps';
import type { PickerSnapshot } from '../../../../src/core/pickerTypes';

export interface PickerClient {
	preview: boolean;
	call(name: string, args?: Record<string, unknown>): Promise<unknown>;
	close(): Promise<void>;
}

export async function providerPickerClient(
	receive: (data: PickerSnapshot) => void
): Promise<PickerClient> {
	const preview = document.body.dataset.pickerPreview === 'true' && window.parent === window;
	if (preview) {
		const client = {
			preview: true,
			call: async (name: string, args: Record<string, unknown> = {}) => {
				const response = await fetch('/tools', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, arguments: args })
				});
				if (!response.ok) throw new Error('Preview request rejected.');
				return response.json() as Promise<unknown>;
			},
			close: async () => {}
		};
		receive((await client.call('open_model_picker')) as PickerSnapshot);
		return client;
	}
	const app = new App({ name: 'Harness model picker', version: '0.1.0' }, {});
	app.ontoolresult = (result) => {
		const data = result.structuredContent;
		if (data && typeof data === 'object' && 'defaultProvider' in data)
			receive(data as unknown as PickerSnapshot);
	};
	await app.connect();
	return {
		preview: false,
		call: async (name, args = {}) => {
			const result = await app.callServerTool({ name, arguments: args });
			if (result.isError)
				throw new Error('Selection rejected. Refresh the panel and check the session ID.');
			return result.structuredContent;
		},
		close: () => app.close()
	};
}
