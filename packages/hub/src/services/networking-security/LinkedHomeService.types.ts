// @harness-uid u_ppvcb4vola
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { BrowserComputerService } from './BrowserComputerService';

export interface LinkedHome {
	/** Computers linked to the signed-in account, online or not. */
	linked: number;
	/** How many of them answered this read. */
	answered: number;
	snapshot: OwnerHomeSnapshot | null;
}

export type Connect = (hostId: string) => BrowserComputerService;
