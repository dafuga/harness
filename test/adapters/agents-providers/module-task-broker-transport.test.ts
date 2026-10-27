import { expect, test } from 'vitest';
import { ModuleTaskBrokerTransportAdapter } from '../../../src/adapters/agents-providers/ModuleTaskBrokerTransportAdapter';

test('ModuleTaskBrokerTransportAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-broker-transport'
	expect(new ModuleTaskBrokerTransportAdapter().connect()).toBe('module-task-broker-transport');
});

test('ModuleTaskBrokerTransportAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskBrokerTransportAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskBrokerTransportAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskBrokerTransportAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
