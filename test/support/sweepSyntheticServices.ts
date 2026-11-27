import type { FixtureProcess } from './syntheticProcessTable.types';
import { fixtureProcessTable, killFixtureProcess } from './syntheticProcessTable';

const maxOrphanAgeSeconds = 30 * 60;
const fixtureHome =
	/(?:\/(?:private\/)?tmp|\/(?:private\/)?var\/folders\/[^/\s]+\/[^/\s]+\/T)\/harness-services-[A-Za-z0-9]+/;
const inlineNode = /^(?:[^\s]+\/)?(?:node|bun) -e /;
const wrapperTail = new RegExp(
	` (${fixtureHome.source})/(?:hung|hung-limit|late|limit)(?: \\1/helper)?$`
);

/** The legacy fixture passed its work directory last, with an optional synthetic executable. */
export function wrapperHome(command: string): string | undefined {
	if (!inlineNode.test(command) || !command.includes('setInterval(() => {}, 1000);'))
		return undefined;
	return wrapperTail.exec(command)?.[1];
}

export function isStaleSyntheticWrapper(row: FixtureProcess): boolean {
	return (
		row.parent === 1 &&
		row.pid > 1 &&
		row.group === row.pid &&
		row.ageSeconds > maxOrphanAgeSeconds &&
		wrapperHome(row.command) !== undefined
	);
}

/** Sweep same-user orphan wrappers. Each wrapper is the leader of its own synthetic group. */
export function sweepSyntheticServices(): number[] {
	return fixtureProcessTable()
		.filter(isStaleSyntheticWrapper)
		.filter((row) => killFixtureProcess(row, true, isStaleSyntheticWrapper))
		.map(({ pid }) => pid);
}

if (import.meta.main) {
	const stopped = sweepSyntheticServices();
	console.log(`Stopped ${stopped.length} stale synthetic service groups`, stopped);
}
