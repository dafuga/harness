// @harness-uid u_ev64zvzg5l
import type {
	CanaryAsk,
	CanaryItem,
	CanaryOptions,
	CanaryOutcome as Outcome,
	CanaryWeb
} from './canary.types';
import { surfaceAnswerers } from './canaryAsk';

const pollMs = 3000;
const appearMs = 120_000;
const reloadMs = 30_000;
const recordMs = 90_000;

const failed = (detail: string): Outcome => ({ state: 'failed', detail });

/** What the Tracker holds after the answer is what passes or fails a surface. */
export function judgeAnswer(item: CanaryItem, ask: CanaryAsk): Outcome {
	const label = ask.labels[ask.expected - 1];
	const actor = surfaceAnswerers[ask.surface];
	const read = `answered_by=${item.answered_by}, answer_option=${item.answer_option}`;
	const right =
		item.answered_by === actor &&
		Number(item.answer_option) === ask.expected &&
		item.answer === label;
	if (right) return { state: 'passed', detail: `${read}, answered_at=${item.answered_at}` };
	return failed(`expected ${actor} and option ${ask.expected}, read ${read}`);
}

async function readAnswer(
	options: CanaryOptions,
	id: string,
	timeoutMs: number
): Promise<CanaryItem | null> {
	const end = options.clock.now() + timeoutMs;
	for (;;) {
		const item = await options.tracker(['show', id]);
		if (item.answered_at) return item;
		if (options.clock.now() >= end) return null;
		await options.clock.wait(pollMs);
	}
}

export async function awaitTap(
	options: CanaryOptions,
	id: string,
	ask: CanaryAsk
): Promise<Outcome> {
	const timeout = options.tapTimeoutMs ?? 600_000;
	options.log(`WAITING FOR DANIEL: ${ask.question}`);
	const item = await readAnswer(options, id, timeout);
	if (!item)
		return { state: 'not-seen', detail: `no tap within ${Math.round(timeout / 60_000)} minutes` };
	const outcome = judgeAnswer(item, ask);
	const note = 'tapped by hand; answered_by names the write path, not the device';
	return { ...outcome, detail: `${outcome.detail} (${note})` };
}

async function findRow(options: CanaryOptions, web: CanaryWeb, marker: string) {
	const start = options.clock.now();
	let loaded = start;
	for (;;) {
		const row = await web.row(marker);
		if (row?.length) return row;
		const now = options.clock.now();
		if (now - start >= appearMs) return row;
		if (now - loaded >= reloadMs) {
			await web.reload();
			loaded = now;
		}
		await options.clock.wait(pollMs);
	}
}

export async function answerOnWeb(
	options: CanaryOptions,
	web: CanaryWeb,
	id: string,
	ask: CanaryAsk
): Promise<Outcome> {
	const label = ask.labels[ask.expected - 1]!;
	const row = await findRow(options, web, ask.marker);
	if (!row) return failed('the test ask did not appear in "Blocked - needs you"');
	if (!row.includes(label)) return failed('the needs-you row has no option buttons for the ask');
	if ((await options.tracker(['show', id])).answered_at)
		return failed('the ask was answered before the script pressed anything');
	if (!(await web.press(ask.marker, label))) return failed(`"${label}" could not be pressed`);
	const item = await readAnswer(options, id, recordMs);
	if (!item) return failed('the Tracker did not record an answer to the press on the row');
	return judgeAnswer(item, ask);
}
