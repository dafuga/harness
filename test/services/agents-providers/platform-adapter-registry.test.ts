import { expect, test, vi } from 'vitest';
import type { PlatformAdapter } from '../../../src/core/agents-providers/platformAdapter.types';
import { PlatformAdapterRegistryService } from '../../../src/services/agents-providers/PlatformAdapterRegistryService';

test('resolves scoped installations and refuses unregistered or duplicate bindings', () => {
	const registry = new PlatformAdapterRegistryService();
	const first: PlatformAdapter = { identity: vi.fn(), send: vi.fn(), subscribe: vi.fn() };
	const second: PlatformAdapter = { identity: vi.fn(), send: vi.fn(), subscribe: vi.fn() };

	registry.register('slack', 'first', first);
	registry.register('slack', 'second', second);
	registry.register('other-platform', 'first', second);

	expect(registry.resolve('slack', 'first')).toBe(first);
	expect(registry.resolve('slack', 'second')).toBe(second);
	expect(registry.resolve('other-platform', 'first')).toBe(second);
	expect(() => registry.resolve('slack', 'missing')).toThrow('binding is unavailable');
	expect(() => registry.register('slack', 'first', second)).toThrow('already bound');
	expect(() => registry.register('../slack', 'first', first)).toThrow('Invalid platform');
	expect(registry.resolve('slack', 'first')).toBe(first);
});
