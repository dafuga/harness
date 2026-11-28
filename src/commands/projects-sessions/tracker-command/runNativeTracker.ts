// @harness-uid u_r7qgepnoax
import type { TrackerSessionRule } from '../../../repositories/projects-sessions/TrackerSessionRuleRepository.types';
import { formatNativeTrackerRules } from './nativeTrackerRule';
import { lstatSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { loadTrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { renderTrackerBackup } from './runLocalTrackerBackup';
import { runLocalTrackerCommand } from './runLocalTrackerCommand';
import {
	formatNativeTrackerItem,
	formatNativeTrackerRunRead,
	nativeItemPrefix,
	nativeItemSuffix
} from './formatNativeTrackerItem';
import {
	formatNativeTrackerAdapterReply,
	formatNativeTrackerInspection,
	nativeJsonCommands
} from './formatNativeTrackerInspection';
import type {
	NativeTrackerAdapterReply,
	NativeTrackerInspection,
	NativeTrackerItem,
	NativeTrackerRefusal,
	NativeTrackerRequest,
	NativeTrackerRunRead
} from './nativeTrackerCli.types';
import { nativeTrackerArgs } from './nativeTrackerRequest';
import { printNativeTrackerHelp, wantsNativeTrackerHelp } from './nativeTrackerHelp';
import { printNativeTrackerAddHint } from './printNativeTrackerAddHint';
import { refuseNativeTrackerRequest } from './printNativeTrackerError';
import { formatNativeTrackerCheck } from './formatNativeTrackerMatches';
import { formatNativeTrackerHistory } from './formatNativeTrackerHistory';
import { runTrackerInstructions } from './runTrackerInstructions';
import { formatNativeTrackerJob } from './formatNativeTrackerJob';
import { fetchNativeTracker } from './fetchNativeTracker';
import { keepRefusedTrackerFlag } from './keepRefusedTrackerFlag';
import type { NativeTrackerJobResponse } from './formatNativeTrackerJob.types';
import type { TrackerItemMatches } from '../../../utils/projects-sessions/checkTrackerItem.types';
import type { TrackerOccurrenceRow } from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import { withTrackerAttachments } from './withTrackerAttachments';

export function selectedTrackerConfig(): string | undefined {
	if (process.env.HARNESS_TRACKER_CONFIG !== undefined) return process.env.HARNESS_TRACKER_CONFIG;
	const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
	const path = join(configHome, 'harness', 'tracker.json');
	try {
		lstatSync(path);
		return path;
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
		return path;
	}
}

export async function runNativeTracker(args: string[], path: string): Promise<number> {
	const help = wantsNativeTrackerHelp(args);
	if (!help && args[0] === 'instructions') return runTrackerInstructions(args.slice(1));
	if (help) return printNativeTrackerHelp();
	let config: TrackerNodeConfig;
	try {
		config = loadTrackerNodeConfig(path);
	} catch {
		console.error('tracker: invalid or unreadable native configuration');
		return 2;
	}
	const local = runLocalTrackerCommand(args, config);
	if (local !== undefined) return local;
	const keep = async (refused: string) => {
		if (args[0] !== 'flag') return;
		const actor = trackerActor('flag', undefined, config.node);
		await keepRefusedTrackerFlag(args, refused, { config, actor });
	};
	let input: ReturnType<typeof nativeTrackerArgs>;
	try {
		input = await withTrackerAttachments(nativeTrackerArgs(args));
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'invalid arguments';
		console.error(`tracker: ${reason}`);
		await keep(reason);
		return 1;
	}
	try {
		return await sendNativeTracker(input, config, keep);
	} catch {
		console.error('tracker: native service unavailable. Check the configured supervisor.');
		await keep('native service unavailable');
		return 3;
	}
}

async function sendNativeTracker(
	input: ReturnType<typeof nativeTrackerArgs>,
	config: TrackerNodeConfig,
	keep: (refused: string) => Promise<void>
) {
	const { command, values, request, words } = input;
	const actor = trackerActor(command, values.by, config.node);
	const body = trackerRequestBody(command, request, actor);
	const response = await fetchNativeTracker(config, { ...request, body }, actor);
	const data = response.headers.get('content-type')?.startsWith('application/json')
		? await response.json()
		: await response.text();
	if (!response.ok)
		return refuseNativeTrackerRequest(response.status, data as NativeTrackerRefusal, keep);
	if (request.path.endsWith('/launch?outcome=run')) return renderLaunch(data, Boolean(values.json));
	if (request.path === '/backup/now') return renderTrackerBackup(data, Boolean(values.json));
	if (command === 'check') return renderCheck(data, Boolean(values.json));
	if (values.json) console.log(JSON.stringify(data, null, 2));
	else {
		renderNativeTracker(command, data, { quiet: Boolean(values.quiet), first: words[0] });
		if (!values.quiet) await printNativeTrackerAddHint(command, data as NativeTrackerItem, config);
	}
	return 0;
}

function trackerActor(command: string, by: string | boolean | undefined, node: string): string {
	const humanDecision = ['park', 'move-on', 'reject'].includes(command);
	const run = process.env.TRACKER_RUN_ID;
	const runActor = run && /^[1-9][0-9]{0,15}$/.test(run) ? `tracker-run-${run}@${node}` : undefined;
	if (humanDecision && runActor) return runActor;
	const claimed = [by, process.env.TRACKER_AS].find(Boolean);
	const fallback = command === 'add' ? runActor : undefined;
	return String(claimed ?? fallback ?? `${userInfo().username}@${node}`);
}

function renderLaunch(
	data: NativeTrackerItem & { run?: { id: number; state: string; node: string } },
	json: boolean
) {
	const run = data?.run;
	if (!Number.isSafeInteger(run?.id) || !run?.state || !run.node) {
		console.error(
			'tracker: native launcher returned no run confirmation. Inspect the pending request with tracker show.'
		);
		return 1;
	}
	if (json) console.log(JSON.stringify(data, null, 2));
	else console.log(`run #${run.id} ${run.state} on ${run.node}: ${formatNativeTrackerItem(data)}`);
	return 0;
}

function trackerRequestBody(command: string, { body }: NativeTrackerRequest, actor: string) {
	if (command === 'start' && process.env.TRACKER_RUN_ID)
		return { session_run: process.env.TRACKER_RUN_ID };
	return command === 'ignore' || command === 'unignore' ? { ...body, by: actor } : body;
}

function renderCheck(matches: TrackerItemMatches, json: boolean) {
	console.log(json ? JSON.stringify(matches, null, 2) : formatNativeTrackerCheck(matches));
	if (matches.ignored.length) return 4;
	return matches.open.length ? 5 : 0;
}

function renderNativeTracker(
	command: string,
	data: unknown,
	options: { quiet: boolean; first?: string }
) {
	if (nativeJsonCommands.has(command)) {
		console.log(JSON.stringify(data, null, 2));
		return;
	}
	switch (command) {
		case 'job':
			console.log(formatNativeTrackerJob(options.first, data as NativeTrackerJobResponse));
			return;
		case 'ensure': {
			const { pid, node } = data as { pid: number; node: string };
			if (!options.quiet) console.log(`tracker running (pid ${pid}, node ${node})`);
			return;
		}
		case 'sync':
			console.log('sync triggered');
			return;

		case 'digest':
			console.log(String(data).trimEnd());
			return;
		case 'list':
			console.log(
				(data as NativeTrackerItem[]).map(formatNativeTrackerItem).join('\n') || '(none)'
			);
			return;
		case 'history':
			console.log(formatNativeTrackerHistory(data as TrackerOccurrenceRow[]));
			return;
		default:
			renderNativeTrackerItemOrReport(command, data, options.first);
	}
}

function renderNativeTrackerItemOrReport(command: string, data: unknown, first?: string): void {
	if (command === 'rule') {
		console.log(formatNativeTrackerRules(data as TrackerSessionRule | TrackerSessionRule[]));
		return;
	}
	if (command === 'reply') {
		console.log(`reply sent to Daniel in the Hub (${(data as { id?: string }).id ?? 'message'})`);
		return;
	}
	if (command === 'adapter' && first !== 'list') {
		console.log(formatNativeTrackerAdapterReply(data as NativeTrackerAdapterReply));
		return;
	}
	const rendered =
		formatNativeTrackerInspection(command, data as NativeTrackerInspection) ??
		formatNativeTrackerRunRead(command, data as NativeTrackerRunRead);
	const item = data as NativeTrackerItem;
	console.log(
		rendered ??
			nativeItemPrefix(command, first, item) +
				formatNativeTrackerItem(item) +
				nativeItemSuffix(command, item)
	);
}
