// @harness-uid u_r7qgepnoax
import { parseArgs } from 'node:util';
import { nativeTrackerTimedItemRequest } from './nativeTrackerTimedItemRequest';
import { nativeTrackerPlanningRequest } from './nativeTrackerPlanningRequest';
import type { NativeTrackerAskValues, NativeTrackerRequest } from './nativeTrackerCli.types';
import { nativeTrackerAnswerBody, nativeTrackerFlagBody } from './nativeTrackerAskOptions';

import {
	nativeTrackerCommandOptions,
	nativeTrackerCommonOptions,
	itemFields,
	nativeTrackerIdVerbs,
	launchAction,
	nativeTrackerInspectionRequest
} from './nativeTrackerOptions';

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
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest {
	const item =
		itemQuery(command, words, values) ??
		runRequest(command, words, values) ??
		nativeTrackerInspectionRequest(command, words, values);
	if (item) return item;
	if (nativeTrackerIdVerbs.has(command)) return itemAction(command, words, values);
	if (words.length) throw new TypeError(`usage: tracker ${command}`);
	if (command === 'sync') return { method: 'POST', path: '/sync' };
	const path = command === 'ensure' ? '/health' : `/${command}`;
	return {
		method: 'GET',
		path: path + (command === 'digest' && !values.json ? '?format=text' : '')
	};
}

function runRequest(
	command: string,
	words: string[],
	values: Record<string, unknown>
): NativeTrackerRequest | undefined {
	switch (command) {
		case 'stop':
			return stopRequest(words);
		case 'watchdog':
			return watchdogRequest(words, values);
		case 'runs':
			if (words.length) throw new TypeError('usage: tracker runs [--item ID] [--limit N]');
			return { method: 'GET', path: '/runs' + query({ item: values.item, limit: values.limit }) };
		case 'models':
			if (words.length !== 1 || words[0] !== 'report')
				throw new TypeError('usage: tracker models report');
			return { method: 'GET', path: '/models/report' };
		case 'pick':
			if (words.length !== 1) throw new TypeError('usage: tracker pick <id>');
			return { method: 'GET', path: '/items/' + encodeURIComponent(words[0]) + '/pick' };
		default:
			return undefined;
	}
}

function stopRequest(words: string[]): NativeTrackerRequest {
	if (words.length !== 1) throw new TypeError('usage: tracker stop <run|item>');
	return { method: 'POST', path: '/stop?target=' + encodeURIComponent(words[0]) };
}

function watchdogRequest(
	[mode, ...trailing]: string[],
	{ item }: Record<string, unknown>
): NativeTrackerRequest {
	if (!trailing.length && mode === 'alerts' && !item)
		return { method: 'GET', path: '/watchdog/alerts' };
	if (!trailing.length && mode === 'dry-run')
		return { method: 'GET', path: '/watchdog/dry-run' + query({ item }) };
	throw new TypeError('usage: tracker watchdog alerts|dry-run [--item ID]');
}

function itemQuery(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
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
				body: {
					...body,
					title,
					kind: creationKind(command, { ...fields, remind_at: values.at })
				}
			};
		}
		case 'list':
			if (words.length) throw new TypeError('usage: tracker list [options]');
			return { method: 'GET', path: '/items' + query(fields) };
		case 'stage':
		case 'artifact':
			return nativeTrackerPlanningRequest(command, words[0], words.slice(1));
		case 'check':
			return {
				method: 'GET',
				path: '/check' + query({ ...fields, text: requiredText(words, command) })
			};
		default:
			return nativeTrackerTimedItemRequest(command, words, values);
	}
}

function creationKind(command: string, fields: Record<string, unknown>) {
	if (command !== 'add') return command;
	if (fields.reminder) return 'reminder';
	if (fields.remind_at && fields.kind !== 'reminder')
		throw new TypeError('tracker add --at requires --reminder');
	return fields.kind;
}

function itemAction(
	command: string,
	[first, ...rest]: string[],
	values: Record<string, string | boolean | undefined>
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
		case 'chase':
			if (rest.length) throw new TypeError('usage: tracker chase <id> [--note text]');
			return { method: 'POST', path: id + '/chase', body: { note: values.note } };
		default:
			return { method: 'POST', path: `${id}/${command}`, body: actionBody(command, rest, values) };
	}
}

function actionBody(command: string, words: string[], values: Record<string, unknown>) {
	const text = words.join(' ');
	switch (command) {
		case 'note':
		case 'progress':
			return { text };
		case 'flag':
			return nativeTrackerFlagBody(text, values as NativeTrackerAskValues);
		case 'block':
			return blockBody(text, values);
		case 'answer':
		case 'resolve':
			return nativeTrackerAnswerBody(text, values as NativeTrackerAskValues);
		case 'done':
			return {
				note: values.note,
				failed: values.failed,
				occurrence: values.occurrence,
				next_step: values['next-step'],
				force: values.force
			};
		case 'unblock':
			return { note: values.note };
		default:
			return undefined;
	}
}

function blockBody(reason: string, values: Record<string, unknown>) {
	return { reason, needs_daniel: values['needs-daniel'] === true, force: values.force };
}

function requiredText(words: string[], command: string): string {
	const value = words.join(' ');
	if (!value) throw new TypeError(`usage: tracker ${command} <text...>`);
	return value;
}

function query(fields: Record<string, unknown>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined && value !== false)
			params.set(key, value === true ? '1' : String(value));
	}
	return params.size ? '?' + params.toString() : '';
}
