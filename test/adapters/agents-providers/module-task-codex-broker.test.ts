import { expect, test } from 'vitest';
import { ModuleTaskCodexBrokerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskCodexBrokerAdapter';

test('ModuleTaskCodexBrokerAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-codex-broker'
	expect(new ModuleTaskCodexBrokerAdapter().connect()).toBe('module-task-codex-broker');
});

test('ModuleTaskCodexBrokerAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskCodexBrokerAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskCodexBrokerAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskCodexBrokerAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
