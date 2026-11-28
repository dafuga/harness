// @harness-uid u_r7qgepnoax
import { parseArgs } from 'node:util';
import { nativeTrackerTimedItemRequest } from './nativeTrackerTimedItemRequest';
import { nativeTrackerPlanningRequest } from './nativeTrackerPlanningRequest';
import type { NativeTrackerAskValues, NativeTrackerRequest } from './nativeTrackerCli.types';
import {
	nativeTrackerAnswerBody,
	nativeTrackerBlockBody,
	nativeTrackerFlagBody
} from './nativeTrackerAskOptions';

import {
	nativeTrackerCommandOptions,
	nativeTrackerCommonOptions,
	itemFields,
	nativeTrackerIdVerbs,
	launchAction
} from './nativeTrackerOptions';
import { nativeTrackerInspectionRequest } from './nativeTrackerInspectionRequest';
import { nativeTrackerQuery as query, nativeTrackerRunRequest } from './nativeTrackerRunRequest';

export const nativeTrackerCommands = [...nativeTrackerCommandOptions.keys()].join(', ');
const trackerHygieneFields = new Map([
	['done', 'note'],
	['block', 'reason']
]);

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
	const request =
		command === 'reply' ? replyRequest(words) : nativeTrackerRequest(command, words, values);
	requireTrackerHygiene(command, words[0], request.body);
	return { command, values, words, request };
}

function requireTrackerHygiene(
	command: string,
	item: string,
	body: NativeTrackerRequest['body']
): void {
	const field = trackerHygieneFields.get(command);
	if (!field || !process.env.TRACKER_RUN_ID) return;
	const runItem = process.env.TRACKER_ITEM_ID ?? '';
	if (!runItem.startsWith(item.trim().toLowerCase())) return;
	const proof = body?.[field];
	const hygiene =
		/^[ \t]*hygiene:[ \t]+closed[ \t]+\d+[ \t]+tabs\/windows(?: I opened)?;[ \t]+left open:[ \t]+\S/im;
	if (typeof proof !== 'string' || !hygiene.test(proof))
		throw new TypeError(
			'close your unused tabs and windows, then include a separate line ' +
				'"hygiene: closed <N> tabs/windows I opened; left open: <none or what and why>" ' +
				(field === 'note' ? 'in --note.' : 'in the block reason.')
		);
}

function nativeTrackerRequest(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest {
	const item =
		itemQuery(command, words, values) ??
		nativeTrackerRunRequest(command, words, values) ??
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

/** Answers one Hub message; the id carries its thread, so nothing else is needed. */
function replyRequest([id, ...text]: string[]): NativeTrackerRequest {
	if (!id || !text.length) throw new TypeError('usage: tracker reply <message id> <text...>');
	return {
		method: 'POST',
		path: '/messages/' + encodeURIComponent(id) + '/reply',
		body: { text: text.join(' ') }
	};
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

const textVerbs = new Set(['note', 'progress', 'alert']);

function actionBody(command: string, words: string[], values: Record<string, unknown>) {
	const text = words.join(' ');
	if (textVerbs.has(command)) return { text };
	switch (command) {
		case 'reject':
			return { reason: text };
		case 'flag':
			return nativeTrackerFlagBody(text, values as NativeTrackerAskValues);
		case 'block':
			return nativeTrackerBlockBody(text, values as NativeTrackerAskValues);
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

function requiredText(words: string[], command: string): string {
	const value = words.join(' ');
	if (!value) throw new TypeError(`usage: tracker ${command} <text...>`);
	return value;
}
