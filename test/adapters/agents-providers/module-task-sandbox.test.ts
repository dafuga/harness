import { expect, test } from 'vitest';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';

test('ModuleTaskSandboxAdapter connects', () => {
	expect(new ModuleTaskSandboxAdapter()).toBeInstanceOf(ModuleTaskSandboxAdapter);
});
