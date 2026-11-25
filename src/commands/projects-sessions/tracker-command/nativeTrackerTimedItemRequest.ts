// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

export function nativeTrackerTimedItemRequest(
	command: string,
	[id, ...words]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (command === 'priority') return priorityRequest(id, words);
	if (command === 'remind') return reminderRequest(id, words, values.at, values.reminder === true);
	if (command === 'park' || command === 'move-on')
		return decisionRequest(command, id, words, values.until);
	return ignoreRequest(command, id, words, values);
}

function ignoreRequest(
	command: string,
	id: string | undefined,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
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
): NativeTrackerRequest {
	const needsDate = command === 'park';
	if (!id || words.length || (needsDate && !until))
		throw new TypeError(`usage: tracker ${command} <id>${needsDate ? ' --until <date>' : ''}`);
	return { method: 'POST', path: `/items/${encodeURIComponent(id)}/${command}`, body: { until } };
}

function reminderRequest(
	id: string | undefined,
	words: string[],
	at: string | boolean | undefined,
	reminder = false
): NativeTrackerRequest {
	if (!id || !at || words.length) throw new TypeError('usage: tracker remind <id> --at <time>');
	return {
		method: 'POST',
		path: `/items/${encodeURIComponent(id)}/remind`,
		body: reminder ? { at, reminder } : { at }
	};
}

function priorityRequest(id: string | undefined, words: string[]): NativeTrackerRequest {
	if (!id || words.length !== 1 || !['urgent', 'normal', 'low'].includes(words[0]))
		throw new TypeError('usage: tracker priority <id> urgent|normal|low');
	return {
		method: 'POST',
		path: `/items/${encodeURIComponent(id)}/priority`,
		body: { priority: words[0] }
	};
}
