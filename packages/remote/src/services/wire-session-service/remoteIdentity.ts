import type { WireRequest } from '../../models/Remote.types';
import { remoteBytes, sha256, toHex } from '../../utils/remoteBytes';
import { stableJson } from './remoteBytes';

/** Identifies what a request asks for, whatever the order of its fields. */
export async function requestDigest(request: WireRequest): Promise<string> {
	return toHex(await sha256(remoteBytes(request.method + '\n' + stableJson(request.input))));
}
