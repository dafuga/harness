import { expect, test } from 'vitest';
import { ModuleTaskContractContextService } from '../../../src/services/agents-providers/ModuleTaskContractContextService';

test('ModuleTaskContractContextService runs', () => {
	expect(new ModuleTaskContractContextService().run()).toBe('module-task-contract-context');
});
