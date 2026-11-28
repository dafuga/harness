// @harness-uid u_q6vu4wcrvc
import type { HomeComputer } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import type { StripComputer } from './hubStripComputers.types';

/** @pure One strip entry per computer, in the order given. */
export function stripComputers(machines: HomeComputer[]): StripComputer[] {
	throw new Error(`stripComputers is not built yet (${machines.length} computers)`);
}
