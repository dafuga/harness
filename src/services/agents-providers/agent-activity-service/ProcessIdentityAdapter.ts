// @harness-uid u_vb356v5djk
import { BoundedCommandAdapter } from '../../../adapters/execution-runtimes/BoundedCommandAdapter';
import type { ProcessFacts } from '../../../utils/agents-providers/agentLiveness';

/**
 * Asks the system about one process: whether it exists and when it started, which together
 * tell a process from a later one that was given the same number. Where the system cannot be
 * asked, nothing is claimed either way.
 */
export class ProcessIdentityAdapter {
	find(pid: number): ProcessFacts {
		try {
			const result = new BoundedCommandAdapter().runSync(
				'ps',
				['-o', 'lstart=', '-p', String(pid)],
				{ timeoutMs: 3000, maxBuffer: 128000, env: { LC_ALL: 'C' } }
			);
			if (result.code !== 0)
				return { exists: result.code === 1 ? false : undefined, startedAt: null };
			const started = result.stdout.toString('utf8').trim();
			return { exists: started !== '', startedAt: started || null };
		} catch (error) {
			// ps ends with 1 for a number no process has; any other failure answers nothing.
			const absent = (error as { status?: number | null }).status === 1;
			return { exists: absent ? false : undefined, startedAt: null };
		}
	}
}
