import { expect, test } from 'vitest';
import { ModuleTaskSandboxProcessAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxProcessAdapter';

test('ModuleTaskSandboxProcessAdapter connects', () => {
	expect(new ModuleTaskSandboxProcessAdapter()).toBeInstanceOf(ModuleTaskSandboxProcessAdapter);
});
