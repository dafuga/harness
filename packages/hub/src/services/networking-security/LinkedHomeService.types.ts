// @harness-uid u_ppvcb4vola
import type { BrowserComputerService } from './BrowserComputerService';

export type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';

export type Connect = (hostId: string) => BrowserComputerService;
