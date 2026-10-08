import { expect, test } from 'vitest';
import { ProviderSwitchService } from '../../src/services/ProviderSwitchService';
import { createPickerFixture } from '../support/picker';

test('queues a session selection durably without changing active or default provider', async () => {
	const { store, catalog, target } = createPickerFixture();
	const service = new ProviderSwitchService(store, catalog);
	await service.request('session-a', target);
	const restored = await new ProviderSwitchService(store, catalog).status('session-a');
	expect(restored).toMatchObject({
		defaultProvider: 'openai',
		active: null,
		controlConnected: false
	});
	expect(restored.request).toMatchObject({ status: 'pending', target });
	expect(restored.message).toContain('unavailable');
	expect((await service.status('session-b')).request).toBeNull();
});

test('deduplicates delivery, cancels explicitly, and rejects unknown provider/model/effort', async () => {
	const { store, catalog, target } = createPickerFixture();
	const service = new ProviderSwitchService(store, catalog);
	const first = await service.request('session-a', target);
	expect((await service.request('session-a', target)).request?.id).toBe(first.request?.id);
	await expect(service.request('../other', target)).rejects.toThrow('session');
	await expect(service.request('session-a', { ...target, model: 'invented' })).rejects.toThrow(
		'catalog'
	);
	await expect(service.request('session-a', { ...target, effort: 'low' })).rejects.toThrow(
		'catalog'
	);
	expect((await service.cancel('session-a', first.request!.id)).request?.status).toBe('cancelled');
	const next = await service.request('session-a', target);
	await expect(service.cancel('session-a', first.request!.id)).rejects.toThrow('changed');
	expect(next.request?.status).toBe('pending');
});
