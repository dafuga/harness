import { expect, test } from 'vitest';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';

test('ModuleTaskService runs', () => {
	expect(new ModuleTaskService().run()).toBe('module-task');
});
