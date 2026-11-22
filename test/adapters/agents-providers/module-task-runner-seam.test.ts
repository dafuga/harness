import { expectTypeOf, test } from 'vitest';
import type { TaskProcessExecutor } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter.types';
import type { Seam } from './module-task-runner.test.types';

// Compile-time only, so it stays outside the module-tasks scenario, whose checks need runtime matchers.
test('the process executor seam is typed, never unknown or any', () => {
	expectTypeOf<Seam>().toEqualTypeOf<TaskProcessExecutor | undefined>();
});
