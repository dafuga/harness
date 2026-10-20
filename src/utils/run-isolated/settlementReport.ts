import type { Judged, Settlement } from '../settlementReport';
import type { TrackedProcess } from '../processDescendants';

const identity = ({ pid, started }: TrackedProcess): TrackedProcess => ({ pid, started });

const same = (one: TrackedProcess) => (other: TrackedProcess) =>
	one.pid === other.pid && one.started === other.started;

function line(item: Judged, outcome: string): string {
	const what = item.verdict.executable ?? 'program unknown';
	return `[harness] process ${item.pid} (started ${item.started}) ${what}: ${outcome}\n`;
}

/**
 * What was done with each process, as it goes into the check log, and what of it counts against
 * the command. Stopped means asked to end and gone at the last look; whatever is still there and
 * was not handed over counts as left running, whoever it is. Of those, one that was sent a
 * signal at any time is said to have been; unless told otherwise, that is who was asked to end.
 */
export function settlementReport(
	asked: Judged[],
	last: Judged[],
	signalled: (item: TrackedProcess) => boolean = (item) => asked.some(same(item))
): Settlement {
	const stopped = asked.filter((item) => !last.some(same(item)));
	const running = last.filter((item) => item.verdict.standing !== 'delegated');
	const done = (item: Judged) =>
		signalled(item) ? 'signalled but still running' : 'left running, not signalled';
	const lines = [
		...last
			.filter((item) => item.verdict.standing === 'delegated')
			.map((item) => line(item, `handed over to the system: ${item.verdict.reason}`)),
		...running.map((item) => line(item, `${done(item)}; the check fails: ${item.verdict.reason}`)),
		...stopped.map((item) => line(item, 'stopped: left behind by the command'))
	];
	return {
		survivors: [...stopped, ...running].map(identity),
		stopped: stopped.length,
		resisted: running.filter(signalled).length,
		unknown: false,
		report: lines.length > 0 ? `\n${lines.join('')}` : ''
	};
}
