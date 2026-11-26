// @harness-uid u_bl6xl2h4a3
import type { TrackerSlotReport } from './trackerSlotInvariants.types';

/** Room for a full cap of about twenty runs. */
const limit = 2000;

/** One line per computer: which slots are held and why, plus finished runs' live panes. */
export function trackerSlotSummary(report: TrackerSlotReport): string {
	const { cap, held, leftover } = report;
	const slots = held.map(({ run, item, why }) => `#${run} ${item.slice(0, 6)} ${why}`);
	const panes = leftover.map(({ session, why }) => `${session} ${why}`);
	const count = cap === null ? `${held.length}` : `${held.length}/${cap}`;
	const text = [
		`${count} launcher slots held${slots.length ? ': ' + slots.join('; ') : ''}`,
		panes.length && `finished-run panes holding no slot: ${panes.join('; ')}`
	]
		.filter(Boolean)
		.join('. ');
	return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
