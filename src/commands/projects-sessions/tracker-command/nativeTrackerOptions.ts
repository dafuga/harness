// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

const text = { type: 'string' } as const;
const flag = { type: 'boolean' } as const;
export const nativeTrackerCommonOptions = { json: flag, quiet: { ...flag, short: 'q' }, by: text };
const launchOptions = { project: text, repo: text, computer: text, model: text, sensitive: flag };
const itemOptions = {
	...launchOptions,
	kind: text,
	due: text,
	owner: text,
	agent: text,
	notes: text,
	parent: text,
	question: text,
	'next-step': text,
	title: text,
	status: text,
	'callback-url': text,
	'callback-cmd': text,
	'needs-daniel': flag,
	auto: flag,
	every: text,
	tz: text,
	force: flag
};
export const nativeTrackerCommandOptions = new Map<
	string,
	Record<string, typeof text | typeof flag>
>([
	['add', { ...itemOptions, later: flag }],
	['plan', itemOptions],
	['goal', itemOptions],
	['update', { ...itemOptions, note: text }],
	['note', {}],
	['progress', {}],
	['flag', { question: text, force: flag }],
	['chase', { note: text }],
	['remind', { at: text }],
	['park', { until: text }],
	['move-on', {}],
	['block', { 'needs-daniel': flag, force: flag }],
	['unblock', { note: text }],
	['ignore', { reason: text, until: text }],
	['unignore', { note: text }],
	['answer', { done: flag }],
	['resolve', { done: flag }],
	['done', { note: text, failed: flag, occurrence: text, 'next-step': text }],
	['launch', launchOptions],
	['unlaunch', {}],
	['show', {}],
	[
		'list',
		{
			status: text,
			kind: text,
			agent: text,
			owner: text,
			parent: text,
			flagged: flag,
			chased: flag,
			recurring: flag,
			limit: text
		}
	],
	['check', { agent: text }],
	['history', { limit: text }],
	['runs', { item: text, limit: text }],
	['models', {}],
	['pick', {}],
	['autolaunch', {}],
	['adapter', { 'dry-run': flag, 'backfill-comments': flag }],
	['backup', {}],
	['start', {}],
	['reopen', {}],
	['unflag', {}],
	['rm', {}],
	['status', {}],
	['digest', {}],
	['sync', {}],
	['watchdog', { item: text }],
	['needs-attention', {}],
	['ensure', {}]
]);

export const nativeTrackerIdVerbs = new Set([
	'show',
	'update',
	'rm',
	'history',
	'launch',
	'unlaunch',
	'start',
	'reopen',
	'note',
	'progress',
	'flag',
	'chase',
	'block',
	'unblock',
	'answer',
	'resolve',
	'done',
	'unflag'
]);

const inspectionRoutes = new Map([
	['autolaunch', { status: '/autolaunch', 'dry-run': '/autolaunch/dry-run' }],
	['adapter', { list: '/adapters' }],
	['backup', { list: '/backup/list' }]
]);

function nativeTrackerAdapterRequest(
	[mode, source, ...trailing]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (mode !== 'run') {
		if (values['dry-run'] || values['backfill-comments'])
			throw new TypeError('adapter polling flags require adapter run');
		return undefined;
	}
	if (!source || trailing.length)
		throw new TypeError('usage: tracker adapter run <source> [--backfill-comments] [--dry-run]');
	const query = new URLSearchParams({ source });
	for (const flag of ['dry-run', 'backfill-comments']) if (values[flag]) query.set(flag, '1');
	return { method: 'POST', path: '/adapters/run?' + query };
}

export function nativeTrackerInspectionRequest(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	const adapter = command === 'adapter' ? nativeTrackerAdapterRequest(words, values) : undefined;
	return adapter ?? nativeTrackerReadInspection(command, words);
}

function nativeTrackerReadInspection(
	command: string,
	words: string[]
): NativeTrackerRequest | undefined {
	const routes: Record<string, string | undefined> | undefined = inspectionRoutes.get(command);
	if (!routes) return undefined;
	const sub = words[0] ?? (command === 'autolaunch' ? 'status' : '');
	if (words.length > 1 || !Object.hasOwn(routes, sub))
		throw new TypeError(`usage: tracker ${command} ${Object.keys(routes).join('|')}`);
	return { method: 'GET', path: routes[sub]! };
}

export function nativeTrackerTimedItemRequest(
	command: string,
	[id, ...words]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (command === 'remind') return reminderRequest(id, words, values.at);
	const decision = decisionRequest(command, id, words, values.until);
	if (decision) return decision;
	if (command !== 'ignore' && command !== 'unignore') return undefined;
	const reason = [values.reason, words.join(' ')].find(Boolean);
	if (command === 'ignore' && !reason)
		throw new TypeError('usage: tracker ignore <id> --reason "<why>" [--until DATE] [--by NAME]');
	if (!id) throw new TypeError(`usage: tracker ${command} <id>`);
	return {
		method: 'POST',
		path: `/items/${encodeURIComponent(id)}/${command}`,
		body: command === 'ignore' ? { reason, until: values.until } : { note: values.note }
	};
}

function decisionRequest(
	command: string,
	id: string | undefined,
	words: string[],
	until: string | boolean | undefined
): NativeTrackerRequest | undefined {
	const needsDate = command === 'park';
	if (!needsDate && command !== 'move-on') return undefined;
	if (!id || words.length || (needsDate && !until))
		throw new TypeError(`usage: tracker ${command} <id>${needsDate ? ' --until <date>' : ''}`);
	return { method: 'POST', path: `/items/${encodeURIComponent(id)}/${command}`, body: { until } };
}

function reminderRequest(
	id: string | undefined,
	words: string[],
	at: string | boolean | undefined
): NativeTrackerRequest {
	if (!id || !at || words.length) throw new TypeError('usage: tracker remind <id> --at <time>');
	return { method: 'POST', path: `/items/${encodeURIComponent(id)}/remind`, body: { at } };
}
