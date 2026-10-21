import { execFileSync } from 'node:child_process';
import type { ProcessFacts } from '../../../utils/agents-providers/agentLiveness';

/**
 * Asks the system about one process: whether it exists and when it started, which together
 * tell a process from a later one that was given the same number. Where the system cannot be
 * asked, nothing is claimed either way.
 */
export class ProcessIdentityAdapter {
	find(pid: number): ProcessFacts {
		try {
			const started = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
				encoding: 'utf8',
				env: { ...process.env, LC_ALL: 'C' },
				stdio: ['ignore', 'pipe', 'ignore'],
				timeout: 3000
			}).trim();
			return { exists: started !== '', startedAt: started || null };
		} catch (error) {
			// ps ends with 1 for a number no process has; any other failure answers nothing.
			const absent = (error as { status?: number | null }).status === 1;
			return { exists: absent ? false : undefined, startedAt: null };
		}
	}
}
