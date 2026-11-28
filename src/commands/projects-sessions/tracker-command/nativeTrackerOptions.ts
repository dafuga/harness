// @harness-uid u_r7qgepnoax
import { resolve } from 'node:path';
import { nativeTrackerAskBody } from './nativeTrackerAskOptions';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';
import { nativeTrackerAdapterOptions } from './nativeTrackerAdapterRequest';

const text = { type: 'string' } as const;
const flag = { type: 'boolean' } as const;
const words = { type: 'string', multiple: true } as const;
const askOptions = { option: words, recommend: text, confirm: text } as const;
export const nativeTrackerCommonOptions = { json: flag, quiet: { ...flag, short: 'q' }, by: text };
export function itemFields(input: Record<string, string | boolean | string[] | undefined>) {
	const { tz, repo } = input;
	const fields = Object.fromEntries(
		Object.entries(input).filter(
			([key]) =>
				!Object.hasOwn(nativeTrackerCommonOptions, key) &&
				![
					'callback-url',
					'callback-cmd',
					'option',
					'recommend',
					'confirm',
					'needs-daniel',
					'next-step',
					'note',
					'tz',
					'reminder',
					'remind-at',
					'at'
				].includes(key)
		)
	);
	return {
		...fields,
		callback_url: input['callback-url'],
		callback_cmd: input['callback-cmd'],
		needs_daniel: input['needs-daniel'],
		...nativeTrackerAskBody(input),
		next_step: input['next-step'],
		remind_at: input['remind-at'] ?? input.at,
		every_tz: tz,
		repo: typeof repo === 'string' && repo ? resolve(repo) : repo
	};
}

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
	...askOptions,
	auto: flag,
	every: text,
	tz: text,
	force: flag
};
export const nativeTrackerCommandOptions = new Map<
	string,
	Record<string, typeof text | typeof flag | typeof words>
>([
	['add', { ...itemOptions, later: flag, reminder: flag, at: text }],
	['plan', itemOptions],
	['goal', itemOptions],
	['update', { ...itemOptions, note: text, 'remind-at': text }],
	['note', {}],
	['alert', {}],
	['progress', {}],
	[
		'flag',
		{
			question: text,
			force: flag,
			...askOptions,
			spec: words,
			doc: words,
			design: words,
			'not-spec-review': flag
		}
	],
	['chase', { note: text }],
	['remind', { at: text, reminder: flag }],
	['priority', {}],
	['park', { until: text }],
	['move-on', {}],
	['block', { force: flag, 'needs-daniel': flag }],
	['unblock', { note: text }],
	['ignore', { reason: text, until: text }],
	['unignore', { note: text }],
	['answer', { done: flag, option: text, confirmed: flag, 'keep-blocked': flag }],
	['resolve', { done: flag }],
	['done', { note: text, failed: flag, occurrence: text, 'next-step': text, force: flag }],
	['launch', launchOptions],
	['unlaunch', {}],
	['show', {}],
	['stage', {}],
	['artifact', { 'merge-links': flag }],
	[
		'list',
		{
			status: text,
			stage: text,
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
	['reply', {}],
	['autolaunch', { until: text }],
	['adapter', nativeTrackerAdapterOptions],
	['backup', { to: text }],
	['job', { cmd: text, 'wake-on': text, timeout: text }],
	['start', {}],
	['stop', {}],
	['reopen', {}],
	['reject', {}],
	['unflag', {}],
	['rm', {}],
	['status', {}],
	['digest', {}],
	['sync', {}],
	['watchdog', { item: text }],
	['machines', { hours: text }],
	['place', { kind: text, 'needs-ram': text }],
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
	'reject',
	'note',
	'alert',
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

export function launchAction(
	path: string,
	[target, ...rest]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest {
	if (target !== 'on' && target !== 'off')
		return { method: 'POST', path: path + '/launch?outcome=run', body: itemFields(values) };
	if (rest.length !== 1) throw new TypeError(`usage: tracker launch ${target} <id>`);
	const verb = target === 'off' ? 'unlaunch' : 'schedule-on';
	return { method: 'POST', path: `/items/${encodeURIComponent(rest[0])}/${verb}` };
}
