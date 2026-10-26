import { expect, test } from 'vitest';
import { ModuleTaskToolBrokerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskToolBrokerAdapter';

test('ModuleTaskToolBrokerAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-tool-broker'
	expect(new ModuleTaskToolBrokerAdapter().connect()).toBe('module-task-tool-broker');
});

test('ModuleTaskToolBrokerAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskToolBrokerAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskToolBrokerAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskToolBrokerAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
