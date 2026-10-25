import { expect, test } from 'vitest';
import { ModuleTaskServerService } from '../../../src/services/agents-providers/ModuleTaskServerService';

test('ModuleTaskServerService runs', () => {
	expect(new ModuleTaskServerService().run()).toBe('module-task-server');
});
