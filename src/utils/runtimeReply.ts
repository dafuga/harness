import {
	runtimeFailure,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime
} from '../core/runtimeTypes';
import { notPortable, portableJson } from './portableJson';

export interface RuntimeReply {
	status: number;
	value: RuntimeResponse;
}

/**
 * What a served unit answers one HTTP request with: one JSON request per POST, and anything
 * else refused before the unit is invoked. Every server of a unit uses this, so they agree.
 */
export async function runtimeReply(
	runtime: UnitRuntime,
	method: string,
	read: () => Promise<string>
): Promise<RuntimeReply> {
	if (method !== 'POST') {
		const value = runtimeFailure('invalid-request', 'send one JSON request per POST');
		return { status: 405, value };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await read());
	} catch {
		return { status: 400, value: runtimeFailure('invalid-json', 'request is not valid JSON') };
	}
	if (!portableJson(parsed)) return { status: 400, value: notPortable };
	return { status: 200, value: await runtime.invoke(parsed as RuntimeRequest) };
}
