import type { ServiceContext } from '../platformServices';
import { probing, sameTime, named } from '../platformServices';
import type { TrackedProcess } from '../processDescendants';

/**
 * The last look before a signal: the process is still the one that was judged, by id and start
 * time, and still runs the program it was judged by. A process that was replaced, runs another
 * program or cannot be read gets no signal. Between this look and the signal nothing holds it:
 * the system offers no way to do both at once.
 */
export async function stillPrivate(
	known: TrackedProcess,
	judgedAs: string | null,
	context: ServiceContext
): Promise<boolean> {
	const probes = probing(context);
	const [seen, live] = await Promise.all([probes.facts(known.pid), probes.executable(known.pid)]);
	if (!seen || !live || live !== judgedAs) return false;
	return sameTime(seen.started, known.started) && !named(live, seen.name);
}
