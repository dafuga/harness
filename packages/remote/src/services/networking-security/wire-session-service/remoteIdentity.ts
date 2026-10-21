import type { WireRequest } from '../../../models/networking-security/Remote.types';
import { remoteBytes, sha256, toHex } from '../../../utils/networking-security/remoteBytes';
import { stableJson } from './remoteBytes';

/** Identifies what a request asks for, whatever the order of its fields. */
export async function requestDigest(request: WireRequest): Promise<string> {
	return toHex(await sha256(remoteBytes(request.method + '\n' + stableJson(request.input))));
}
