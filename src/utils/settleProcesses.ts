import { cleanupDeadline, type CleanupDeadline } from './cleanupDeadline';
import {
	classifyProcess,
	stillPrivate,
	type ServiceContext,
	type Verdict
} from './platformServices';
import type { FollowedProcess, TrackedProcess } from './processDescendants';
import {
	settlementReport,
	unknownSettlement,
	type Judged,
	type Settlement,
	type Watched
} from './settlementReport';

export type { Settlement, Watched } from './settlementReport';

export interface SettleTiming {
	settleMs: number;
	graceMs: number;
	/** The bound of the whole settling; after it nothing is read, judged or signalled. */
	cleanupMs?: number;
}
/** What one command's settling remembers between its looks. */
interface Session {
	/** Who stood with a service, by id and start time; what such a one started stands with it. */
	shielded: Set<string>;
	/** Who was sent a signal, at the time limit or after the end, by id and start time. */
	signalled: Set<string>;
	halting: CleanupDeadline | null;
}
interface Work {
	watch: Watched;
	context: ServiceContext;
	session: Session;
	deadline: CleanupDeadline;
}

type Stop = 'SIGTERM' | 'SIGKILL';
const stepMs = 100;
/** So close to the end of the settle time no new judgement is begun. */
const quietMs = 300;
/** What the whole settling may take beyond its settle and grace times. */
const slackMs = 10_000;
const sessions = new WeakMap<Watched, Session>();
const key = (item: TrackedProcess) => `${item.pid} ${item.started}`;
const same = (one: TrackedProcess) => (other: TrackedProcess) => key(one) === key(other);
const shared = (item: Judged) => item.verdict.standing !== 'private';
const unjudged = (reason: string): Verdict => ({ standing: 'protected', reason, executable: null });
function working(watch: Watched, context: ServiceContext, deadline: CleanupDeadline): Work {
	const fresh = { shielded: new Set<string>(), signalled: new Set<string>(), halting: null };
	const session = sessions.get(watch) ?? fresh;
	sessions.set(watch, session);
	return { watch, context: { ...context, signal: deadline.signal }, session, deadline };
}

/**
 * How each process stands. Standing with a service is kept by id and start time: once seen, it
 * holds for that process and for what it started, also after the service itself has gone. The
 * same id under another start time is another process and lends nothing.
 */
async function judged(alive: FollowedProcess[], work: Work): Promise<Judged[]> {
	const late = unjudged('it could not be judged in time');
	const one = (item: FollowedProcess) =>
		item.proven
			? work.deadline.within(classifyProcess(item, work.context), late)
			: Promise.resolve(unjudged('it is in the group of the command but not shown to be its own'));
	const verdicts = await Promise.all(alive.map(one));
	const present = alive
		.map((item, index) => ({ ...item, verdict: verdicts[index] }))
		.filter((item) => item.verdict.standing !== 'gone');
	const kept = work.session.shielded;
	for (const item of present.filter(shared)) kept.add(key(item));
	for (let changed = true; changed; ) {
		changed = false;
		for (const item of present.filter((other) => !shared(other))) {
			if (!kept.has(key(item)) && !(item.origin && kept.has(key(item.origin)))) continue;
			item.verdict = { ...item.verdict, standing: 'protected', reason: 'it works for a service' };
			kept.add(key(item));
			changed = true;
		}
	}
	return present;
}

/**
 * Signals the command's own among the judged, and nothing else. Each one is looked at once more
 * just before its signal: its identity and its program must still be what was judged, and the
 * settling must not be over. There is no signal to a group.
 */
async function signalOwn(targets: Judged[], work: Work, signal: Stop): Promise<Judged[]> {
	const sent: Judged[] = [];
	const one = async (item: Judged) => {
		const fresh = stillPrivate(item, item.verdict.executable, work.context);
		if (!(await work.deadline.within(fresh, false)) || work.deadline.expired()) return;
		try {
			process.kill(item.pid, signal);
			work.session.signalled.add(key(item));
			sent.push(item);
		} catch {
			// It ended between the look and the signal.
		}
	};
	await Promise.all(targets.filter((item) => !shared(item)).map(one));
	return sent;
}

/**
 * Stops the command and its own at its time limit: asked, and forced after the grace time, all
 * under the given deadline. An unreadable table signals nothing.
 */
export async function haltProcesses(
	watch: Watched,
	context: ServiceContext,
	limit: { graceMs: number; deadline: CleanupDeadline }
): Promise<void> {
	const work = working(watch, context, limit.deadline);
	work.session.halting = limit.deadline;
	for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
		const alive = await work.deadline.within(watch.alive(), null);
		if (!alive || work.deadline.expired()) return;
		await signalOwn(await judged(alive, work), work, signal);
		if (signal === 'SIGTERM') await work.deadline.pause(limit.graceMs);
	}
}

/** Judges everything that is alive, then ends the command's own inside its group. */
async function looked(alive: FollowedProcess[], work: Work): Promise<Judged[]> {
	const all = alive.length > 0 ? await judged(alive, work) : [];
	const inside = all.filter((item) => item.group === work.context.group);
	if (inside.some((item) => !shared(item))) await signalOwn(inside, work, 'SIGKILL');
	return all;
}

/**
 * Waits for what left the group to end by itself, for at most the settle time. The last look
 * before that time is only a read of what still exists; nothing is judged after it has passed.
 */
async function lingering(work: Work, settleMs: number): Promise<Judged[] | null> {
	const began = Date.now();
	for (let rest: Judged[] = []; ; ) {
		const alive = await work.deadline.within(work.watch.alive(), null);
		if (!alive || work.deadline.expired()) return null;
		const due = Date.now() - began >= settleMs;
		if (due && alive.every((item) => rest.some(same(item))))
			return rest.filter((item) => alive.some(same(item)));
		rest = await looked(alive, work);
		if (rest.every((item) => item.verdict.standing === 'delegated')) return rest;
		const left = settleMs - (Date.now() - began);
		await work.deadline.pause(left > quietMs ? stepMs : Math.max(left, 0));
	}
}

/** Asks the command's own leftovers to end, forces them after the grace time, and looks again. */
async function ended(work: Work, left: Judged[], graceMs: number) {
	const asked = await signalOwn(left, work, 'SIGTERM');
	if (asked.length > 0) await work.deadline.pause(graceMs);
	const after = await work.deadline.within(work.watch.alive(), null);
	if (after && asked.length > 0) await signalOwn(await judged(after, work), work, 'SIGKILL');
	if (after && asked.length > 0) await work.deadline.pause(stepMs);
	const last = after && (await work.deadline.within(work.watch.alive(), null));
	return { asked, last: last ? await judged(last, work) : null };
}

async function settled(work: Work, timing: SettleTiming): Promise<Settlement> {
	const unread = 'the processes could not be read or judged in time';
	const left = await lingering(work, timing.settleMs);
	if (!left) return unknownSettlement(unread);
	const leftovers = left.some((item) => !shared(item));
	const { asked, last } = leftovers
		? await ended(work, left, timing.graceMs)
		: { asked: [], last: left };
	const signalled = (item: TrackedProcess) => work.session.signalled.has(key(item));
	return last && !work.deadline.expired()
		? settlementReport(asked, last, signalled)
		: unknownSettlement(unread);
}

/**
 * Settles what a command left when it ended, within one bound. The command's own inside its
 * group ends with it; what left the group may end by itself, and is then asked and at last
 * forced to end, counting against the command. A vetted service that left the command is handed
 * to the system and recorded. What might be a shared service, works for one, or is not shown to
 * be the command's own is left running, recorded, and fails the command. Whatever goes wrong
 * ends as unknown; once this has answered, nothing it started reads, judges or signals any more.
 */
export async function settleProcesses(
	watch: Watched,
	context: ServiceContext,
	timing: SettleTiming = { settleMs: 2000, graceMs: 500 }
): Promise<Settlement> {
	const bound = timing.cleanupMs ?? timing.settleMs + timing.graceMs + slackMs;
	const work = working(watch, context, cleanupDeadline(bound));
	work.session.halting?.cancel();
	try {
		return await settled(work, timing);
	} catch (error) {
		return unknownSettlement(
			`settling failed (${error instanceof Error ? error.message : 'unknown'})`
		);
	} finally {
		work.deadline.cancel();
	}
}
