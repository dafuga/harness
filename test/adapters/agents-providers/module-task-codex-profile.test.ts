import { expect, test } from 'vitest';
import { ModuleTaskCodexProfileAdapter } from '../../../src/adapters/agents-providers/ModuleTaskCodexProfileAdapter';

test('ModuleTaskCodexProfileAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-codex-profile'
	expect(new ModuleTaskCodexProfileAdapter().connect()).toBe('module-task-codex-profile');
});

test('ModuleTaskCodexProfileAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskCodexProfileAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskCodexProfileAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskCodexProfileAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
