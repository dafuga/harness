// @harness-uid u_r7qgepnoax
import type { NativeTrackerAdapterValues } from './nativeTrackerAdapterRequest.types';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

const text = { type: 'string' } as const;
const flag = { type: 'boolean' } as const;
const sourceOptions = [
	'agent',
	'project',
	'owner',
	'kind',
	'every',
	'tz',
	'model',
	'computer',
	'include-labels',
	'exclude-labels',
	'auto-launch'
];
const messageOptions = ['title', 'from', 'domain', 'thread', 'keyword', 'quiet-hours', 'notify'];
const messageTaskOptions = ['agent', 'project', 'owner', 'auto-launch'];
export const nativeTrackerAdapterOptions: Record<string, typeof text | typeof flag> = {
	...Object.fromEntries(
		[...sourceOptions, ...messageOptions, 'repo', 'target', 'after'].map((name) => [name, text])
	),
	'dry-run': flag,
	backfill: flag,
	'backfill-comments': flag
};
export const nativeTrackerAdapterUsage =
	'adapter list|run <source> [--backfill|--backfill-comments] [--dry-run]|pause|resume|remove <source>|' +
	'add github --repo OWNER/REPO --agent NAME [--project P] [--owner O] [--kind K] [--every CRON] ' +
	'[--tz ZONE] [--model M] [--computer C] [--include-labels L,L] [--exclude-labels L,L] ' +
	'[--auto-launch never|unlabeled] [--dry-run [--after ISO] [--backfill]] | ' +
	'add gmail --target RULE --title TITLE [--from EMAILS] [--domain DOMAINS] [--thread IDS] ' +
	'[--keyword PHRASE] [--quiet-hours HH:MM-HH:MM] (--notify ITEM | --agent NAME [--project P] ' +
	'[--owner O] [--auto-launch never|match]) [--dry-run] [--after ISO]';

const allowedOptions: Record<string, readonly string[]> = {
	add: [...sourceOptions, ...messageOptions, 'repo', 'target', 'after', 'dry-run', 'backfill'],
	run: ['dry-run', 'backfill', 'backfill-comments'],
	pause: [],
	resume: [],
	remove: []
};

/** Build every adapter request except list, which is a plain inspection read. */
export function nativeTrackerAdapterRequest(
	[mode = 'list', target, ...trailing]: string[],
	values: NativeTrackerAdapterValues
): NativeTrackerRequest | undefined {
	rejectStrayOptions(mode, values);
	if (!Object.hasOwn(allowedOptions, mode)) return undefined;
	if (!target || trailing.length)
		throw new TypeError(`usage: tracker ${nativeTrackerAdapterUsage}`);
	if (mode === 'add') return addRequest(target, values);
	if (values.backfill && values['backfill-comments'])
		throw new TypeError('tracker adapter run takes one backfill mode');
	const query = new URLSearchParams({ source: target });
	setFlags(query, values, ['dry-run', 'backfill', 'backfill-comments']);
	return { method: 'POST', path: `/adapters/${mode}?${query}` };
}

function rejectStrayOptions(mode: string, values: NativeTrackerAdapterValues): void {
	const allowed = allowedOptions[mode] ?? [];
	const stray = Object.keys(nativeTrackerAdapterOptions).find(
		(name) => values[name] !== undefined && !allowed.includes(name)
	);
	if (stray) throw new TypeError(`--${stray} does not apply to tracker adapter ${mode}`);
}

function addRequest(type: string, values: NativeTrackerAdapterValues): NativeTrackerRequest {
	const preview = values['dry-run'] === true;
	const message = type === 'gmail';
	const disallowed = message
		? [...sourceOptions.filter((name) => !messageTaskOptions.includes(name)), 'repo', 'backfill']
		: messageOptions;
	const stray = disallowed.find((name) => values[name] !== undefined);
	if (stray) throw new TypeError(`--${stray} does not apply to tracker adapter add ${type}`);
	if (!message && !preview && (values.after !== undefined || values.backfill))
		throw new TypeError('use --after or --backfill on adapter add only with --dry-run');
	const query = new URLSearchParams();
	setFlags(query, values, ['dry-run', 'backfill']);
	if (typeof values.after === 'string') query.set('after', values.after);
	const fields = (message ? [...messageOptions, ...messageTaskOptions] : sourceOptions).map(
		(name) => [name.replace(/-/g, '_'), values[name]]
	);
	return {
		method: 'POST',
		path: `/adapters/add?${query}`,
		body: { ...Object.fromEntries(fields), type, target: values.target ?? values.repo }
	};
}

function setFlags(
	query: URLSearchParams,
	values: NativeTrackerAdapterValues,
	names: string[]
): void {
	for (const name of names) if (values[name]) query.set(name, '1');
}
