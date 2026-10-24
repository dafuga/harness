import { expect, test } from 'vitest';
import { ModuleTaskCommand } from '../../../src/commands/agents-providers/ModuleTaskCommand';

test('ModuleTaskCommand runs', () => {
	expect(new ModuleTaskCommand().run()).toBe('module-task');
});
