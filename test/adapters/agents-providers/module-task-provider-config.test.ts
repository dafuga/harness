import { expect, test } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';

test('ModuleTaskProviderConfigAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-provider-config'
	expect(new ModuleTaskProviderConfigAdapter().connect()).toBe('module-task-provider-config');
});

test('ModuleTaskProviderConfigAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskProviderConfigAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskProviderConfigAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskProviderConfigAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
