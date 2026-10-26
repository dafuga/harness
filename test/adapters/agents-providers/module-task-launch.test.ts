import { expect, test } from 'vitest';
import { ModuleTaskLaunchAdapter } from '../../../src/adapters/agents-providers/ModuleTaskLaunchAdapter';

test('ModuleTaskLaunchAdapter connects', () => {
	expect(new ModuleTaskLaunchAdapter()).toBeInstanceOf(ModuleTaskLaunchAdapter);
});
