// @harness-uid u_r7qgepnoax
import { lstatSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { loadTrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import {
	formatNativeTrackerItem,
	formatNativeTrackerRunRead,
	nativeItemPrefix
} from './formatNativeTrackerItem';
import {
	formatNativeTrackerAdapterRun,
	formatNativeTrackerInspection
} from './formatNativeTrackerInspection';
import type {
	NativeTrackerInspection,
	NativeTrackerItem,
	NativeTrackerRequest,
	NativeTrackerRunRead
} from './nativeTrackerCli.types';
import { nativeTrackerArgs, nativeTrackerCommands } from './nativeTrackerRequest';

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
	if (!args.length || args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
		console.log(
			`Usage: tracker <command> [arguments] [--json]\nNative commands: ${nativeTrackerCommands}\n` +
				'Subcommands: autolaunch [status|dry-run], adapter list|run <source> [--backfill-comments] [--dry-run], backup list'
		);
		return 0;
	}
	let config: TrackerNodeConfig;
	try {
		config = loadTrackerNodeConfig(path);
	} catch {
		console.error('tracker: invalid or unreadable native configuration');
		return 2;
	}
	let input: ReturnType<typeof nativeTrackerArgs>;
	try {
		input = nativeTrackerArgs(args);
	} catch (error) {
		console.error(`tracker: ${error instanceof Error ? error.message : 'invalid arguments'}`);
		return 1;
	}
	try {
		return await sendNativeTracker(input, config);
	} catch {
		console.error('tracker: native service unavailable. Check the configured supervisor.');
		return 3;
	}
}

async function sendNativeTracker(
	input: ReturnType<typeof nativeTrackerArgs>,
	config: TrackerNodeConfig
) {
	const { command, values, request, words } = input;
	const actor = String(
		[values.by, process.env.TRACKER_AS].find(Boolean) ?? `${userInfo().username}@${config.node}`
	);
	const body = trackerRequestBody(command, request, actor);
	const response = await fetch(`http://127.0.0.1:${config.apiPort}/native/v1${request.path}`, {
		method: request.method,
		body: JSON.stringify(body),
		headers: {
			'content-type': 'application/json',
			'x-tracker-as': actor.replace(/[^\x20-\x7e]/g, '?').slice(0, 80),
			'x-harness-tracker-node': config.node,
			'x-harness-tracker-role': config.role
		},
		redirect: 'error',
		signal: AbortSignal.timeout(request.path.startsWith('/adapters/run?') ? 120_000 : 15_000)
	});
	const data = response.headers.get('content-type')?.startsWith('application/json')
		? await response.json()
		: await response.text();
	if (!response.ok) return printResponseError(response.status, data);
	if (command === 'check') return renderCheck(data, Boolean(values.json));
	if (values.json) console.log(JSON.stringify(data, null, 2));
	else renderNativeTracker(command, data, { quiet: Boolean(values.quiet), first: words[0] });
	return 0;
}

function trackerRequestBody(command: string, { body }: NativeTrackerRequest, actor: string) {
	if (command === 'start' && process.env.TRACKER_RUN_ID)
		return { session_run: process.env.TRACKER_RUN_ID };
	return command === 'ignore' || command === 'unignore' ? { ...body, by: actor } : body;
}

function printResponseError(status: number, data: { error?: string; code?: string }) {
	if (status === 404 && !data?.error) {
		console.error('tracker: the configured listener does not serve native Tracker commands');
		return 3;
	}
	console.error(`tracker: ${data?.error ?? `HTTP ${status}`}`);
	if (data?.code === 'ignored_duplicate') return 4;
	if (data?.code === 'open_duplicate') return 5;
	return 1;
}

function renderCheck(
	data: { ignored: NativeTrackerItem[]; open: NativeTrackerItem[] },
	json: boolean
) {
	const { ignored, open } = data;
	if (json) console.log(JSON.stringify(data, null, 2));
	else if (ignored.length || open.length)
		console.log([...ignored, ...open].map(formatNativeTrackerItem).join('\n'));
	else console.log('no similar items (not ignored, not already open)');
	if (ignored.length) return 4;
	return open.length ? 5 : 0;
}

function renderNativeTracker(
	command: string,
	data: unknown,
	options: { quiet: boolean; first?: string }
) {
	switch (command) {
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
		case 'status':
		case 'autolaunch':
		case 'history':
		case 'watchdog':
		case 'needs-attention':
			console.log(JSON.stringify(data, null, 2));
			return;
		case 'list':
			console.log(
				(data as NativeTrackerItem[]).map(formatNativeTrackerItem).join('\n') || '(none)'
			);
			return;
		default:
			renderNativeTrackerItemOrReport(command, data, options.first);
	}
}

function renderNativeTrackerItemOrReport(command: string, data: unknown, first?: string): void {
	if (command === 'adapter' && first === 'run') {
		console.log(
			formatNativeTrackerAdapterRun(data as Parameters<typeof formatNativeTrackerAdapterRun>[0])
		);
		return;
	}
	const rendered =
		formatNativeTrackerInspection(command, data as NativeTrackerInspection) ??
		formatNativeTrackerRunRead(command, data as NativeTrackerRunRead);
	const item = data as NativeTrackerItem;
	console.log(rendered ?? nativeItemPrefix(command, first, item) + formatNativeTrackerItem(item));
}
