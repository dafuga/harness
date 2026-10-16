import {
	RemoteFailure,
	remoteErrorMessages,
	remoteLimits,
	remoteMethods
} from '../models/Remote.types';
import type {
	RemoteError,
	RemoteErrorCode,
	RemoteMethod,
	WireChannel,
	WireEvent,
	WireRequest,
	WireResponse
} from '../models/Remote.types';
import { remoteBytes } from '../utils/remoteBytes';
import { remotePatterns } from '../utils/remoteIdentity';

type Fields = Record<string, unknown>;
const channels: readonly string[] = ['run', 'cache', 'connection'];

function fields(value: unknown): Fields | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null;
}
function exact(item: Fields, keys: string): boolean {
	return Object.keys(item).sort().join(',') === keys;
}
function refuse(code: RemoteErrorCode, requestId?: string): never {
	const failure = new RemoteFailure(code);
	failure.requestId = requestId;
	throw failure;
}
function errorOf(value: unknown): RemoteError | null {
	const error = fields(value);
	if (!error || !exact(error, 'code,message')) return null;
	const { code, message } = error;
	const known = typeof code === 'string' && Object.hasOwn(remoteErrorMessages, code);
	return known && typeof message === 'string' ? { code: code as RemoteErrorCode, message } : null;
}
function requestId(item: Fields): string | undefined {
	return typeof item.id === 'string' && remotePatterns.requestId.test(item.id)
		? item.id
		: undefined;
}

/** The three wire shapes and nothing else: no extra field, no unlisted method. */
export class WireMessageValidator {
	/** Host side. A failure carries `requestId` whenever the request can still be answered. */
	request(text: string): WireRequest {
		const item = this.parse(text, remoteLimits.requestBytes),
			id = requestId(item),
			input = fields(item.input);
		if (!id || item.type !== 'request' || !exact(item, 'id,input,method,type'))
			return refuse('invalid-message', id);
		if (typeof item.method !== 'string' || !input) return refuse('invalid-message', id);
		if (!(remoteMethods as readonly string[]).includes(item.method))
			return refuse('unknown-method', id);
		return { type: 'request', id, method: item.method as RemoteMethod, input };
	}
	/** Client side: a response or an event. */
	message(text: string): WireResponse | WireEvent {
		const item = this.parse(text, remoteLimits.messageBytes);
		if (item.type === 'event') return this.event(item);
		if (item.type === 'response') return this.response(item);
		return refuse('invalid-message');
	}
	private parse(text: string, limit: number): Fields {
		if (text.length > limit || (text.length * 3 > limit && remoteBytes(text).length > limit))
			return refuse('too-large');
		try {
			return fields(JSON.parse(text)) ?? refuse('invalid-message');
		} catch (error) {
			return error instanceof RemoteFailure ? refuse(error.code) : refuse('invalid-message');
		}
	}
	private event(item: Fields): WireEvent {
		const { channel, sequence } = item;
		const valid =
			exact(item, 'channel,sequence,type,value') &&
			channels.includes(channel as string) &&
			Number.isSafeInteger(sequence) &&
			(sequence as number) >= 1;
		if (!valid) return refuse('invalid-message');
		return {
			type: 'event',
			channel: channel as WireChannel,
			sequence: sequence as number,
			value: item.value
		};
	}
	private response(item: Fields): WireResponse {
		const id = requestId(item);
		if (!id) return refuse('invalid-message');
		if (item.ok === true && exact(item, 'id,ok,type,value'))
			return { type: 'response', id, ok: true, value: item.value };
		const error = errorOf(item.error);
		if (item.ok !== false || !error || !exact(item, 'error,id,ok,type'))
			return refuse('invalid-message');
		return { type: 'response', id, ok: false, error };
	}
}
