// @harness-uid u_rw46z3zz35
import { BoundedCommandAdapter } from '../../adapters/execution-runtimes/BoundedCommandAdapter';
import type {
	BoundedCommandOptions,
	BoundedCommandResult
} from '../../adapters/execution-runtimes/BoundedCommandAdapter.types';
import { resourceEnvironment } from './resourceEnvironment';
import { resourceWork } from './resourceWork';

/**
 * Both shell-based project checks and structured evaluator agents use the same
 * resource lease and process bounds. Callers forward only the environment they need.
 */
export function runLoopEvaluatorProcess(
	root: string,
	argv: string[],
	options: BoundedCommandOptions,
	label = 'Semantic evaluator'
): Promise<BoundedCommandResult> {
	return resourceWork({ priority: 'agent-test', label }, (lease) =>
		new BoundedCommandAdapter().run(argv[0], argv.slice(1), {
			...options,
			cwd: root,
			env: { ...resourceEnvironment(lease.env), ...options.env },
			onSpawn: (child) => {
				if (child.pid) lease.track(child.pid);
			}
		})
	);
}
