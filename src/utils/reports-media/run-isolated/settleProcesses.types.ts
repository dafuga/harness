import type { CleanupDeadline } from '../../development-tooling/cleanupDeadline';
import type { Watched } from '../settlementReport';
import type { ServiceContext } from '../platformServices';

/** What one command's settling remembers between its looks. */
export interface Session {
	/** Who stood with a service, by id and start time; what such a one started stands with it. */
	shielded: Set<string>;
	/** Who was sent a signal, at the time limit or after the end, by id and start time. */
	signalled: Set<string>;
	halting: CleanupDeadline | null;
}

export interface Work {
	watch: Watched;
	context: ServiceContext;
	session: Session;
	deadline: CleanupDeadline;
}

export type Stop = 'SIGTERM' | 'SIGKILL';
