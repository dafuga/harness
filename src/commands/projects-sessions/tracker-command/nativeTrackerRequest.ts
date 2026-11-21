// @harness-uid u_r7qgepnoax
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

import { nativeTrackerCommandOptions, nativeTrackerCommonOptions } from './nativeTrackerOptions';

const idVerbs = new Set([
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
	'block',
	'unblock',
	'answer',
	'resolve',
	'done',
	'unflag'
]);

export const nativeTrackerCommands = [...nativeTrackerCommandOptions.keys()].join(', ');

export function nativeTrackerArgs(args: string[]) {
	const command = args[0];
	const options = nativeTrackerCommandOptions.get(command);
	if (!options) throw new TypeError('command is unavailable in native mode; run tracker help');
	const { values, positionals: words } = parseArgs({
		args: args.slice(1),
		allowPositionals: true,
		allowNegative: true,
		options: { ...nativeTrackerCommonOptions, ...options }
	});
	return { command, values, words, request: nativeTrackerRequest(command, words, values) };
}

function nativeTrackerRequest(
	command: string,
	words: string[],
	values: Record<string, unknown>
): NativeTrackerRequest {
	const item = itemQuery(command, words, values);
	if (item) return item;
	if (idVerbs.has(command)) return itemAction(command, words, values);
	if (words.length) throw new TypeError(`usage: tracker ${command}`);
	if (command === 'sync') return { method: 'POST', path: '/sync' };
	const path = command === 'ensure' ? '/health' : `/${command}`;
	return {
		method: 'GET',
		path: path + (command === 'digest' && !values.json ? '?format=text' : '')
	};
}

function itemQuery(
	command: string,
	words: string[],
	values: Record<string, unknown>
): NativeTrackerRequest | undefined {
	const fields = Object.fromEntries(
		Object.entries(values).filter(([key]) => !Object.hasOwn(nativeTrackerCommonOptions, key))
	);
	switch (command) {
		case 'add':
		case 'plan':
		case 'goal': {
			const title = requiredText(words, command);
			const body = itemFields(fields);
			return {
				method: 'POST',
				path: '/items',
				body: { ...body, title, kind: command === 'add' ? fields.kind : command }
			};
		}
		case 'list':
			if (words.length) throw new TypeError('usage: tracker list [options]');
			return { method: 'GET', path: '/items' + query(fields) };
		case 'check':
			return {
				method: 'GET',
				path: '/check' + query({ ...fields, text: requiredText(words, command) })
			};
		default:
			return undefined;
	}
}

function itemAction(
	command: string,
	[first, ...rest]: string[],
	values: Record<string, unknown>
): NativeTrackerRequest {
	if (!first) throw new TypeError(`usage: tracker ${command} <id>`);
	const id = '/items/' + encodeURIComponent(first);
	switch (command) {
		case 'show':
			return { method: 'GET', path: id };
		case 'rm':
			return { method: 'DELETE', path: id };
		case 'history':
			return { method: 'GET', path: id + '/history' + query({ limit: values.limit }) };
		case 'update':
			return {
				method: 'PATCH',
				path: id,
				body: itemFields({ ...values, append_note: values.note })
			};
		case 'launch':
			return launchAction(id, [first, ...rest], values);
		default:
			return { method: 'POST', path: `${id}/${command}`, body: actionBody(command, rest, values) };
	}
}

function launchAction(
	path: string,
	[target, ...rest]: string[],
	values: Record<string, unknown>
): NativeTrackerRequest {
	if (target !== 'on' && target !== 'off')
		return { method: 'POST', path: path + '/launch', body: itemFields(values) };
	if (rest.length !== 1) throw new TypeError(`usage: tracker launch ${target} <id>`);
	const verb = target === 'off' ? 'unlaunch' : 'schedule-on';
	return { method: 'POST', path: `/items/${encodeURIComponent(rest[0])}/${verb}` };
}

function actionBody(command: string, words: string[], values: Record<string, unknown>) {
	const text = words.join(' ');
	switch (command) {
		case 'note':
		case 'progress':
			return { text };
		case 'flag':
			return { question: text.length ? text : values.question, force: values.force };
		case 'block':
			return blockBody(text, values);
		case 'answer':
		case 'resolve':
			return resolveBody(text, values);
		case 'done':
			return { note: values.note, failed: values.failed, occurrence: values.occurrence };
		case 'unblock':
			return { note: values.note };
		default:
			return undefined;
	}
}

function resolveBody(answer: string, values: Record<string, unknown>) {
	return { answer: answer.length ? answer : undefined, done: values.done, by: values.by };
}

function blockBody(reason: string, values: Record<string, unknown>) {
	return { reason, needs_daniel: values['needs-daniel'] !== false, force: values.force };
}

function itemFields(input: Record<string, unknown>) {
	const { tz, repo } = input;
	const fields = Object.fromEntries(
		Object.entries(input).filter(
			([key]) =>
				!Object.hasOwn(nativeTrackerCommonOptions, key) &&
				!['callback-url', 'callback-cmd', 'needs-daniel', 'note', 'tz'].includes(key)
		)
	);
	return {
		...fields,
		callback_url: input['callback-url'],
		callback_cmd: input['callback-cmd'],
		needs_daniel: input['needs-daniel'],
		every_tz: tz,
		repo: typeof repo === 'string' && repo ? resolve(repo) : repo
	};
}

function query(fields: Record<string, unknown>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined && value !== false)
			params.set(key, value === true ? '1' : String(value));
	}
	return params.size ? '?' + params.toString() : '';
}

function requiredText(words: string[], command: string): string {
	const value = words.join(' ');
	if (!value) throw new TypeError(`usage: tracker ${command} <text...>`);
	return value;
}
