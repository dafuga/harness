import { expect, test } from 'vitest';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';

test('ModuleTaskRepository saves records', () => {
	expect(new ModuleTaskRepository()).toBeInstanceOf(ModuleTaskRepository);
});
