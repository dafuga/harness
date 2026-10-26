import { expect, test } from 'vitest';
import { ModuleTaskDependencyBaseAdapter } from '../../../src/adapters/agents-providers/ModuleTaskDependencyBaseAdapter';

test('ModuleTaskDependencyBaseAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-dependency-base'
	expect(new ModuleTaskDependencyBaseAdapter().connect()).toBe('module-task-dependency-base');
});

test('ModuleTaskDependencyBaseAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskDependencyBaseAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskDependencyBaseAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskDependencyBaseAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
