import type { RemoteBinary } from '../models/Environment.types';

export const unreadableMedia = 'The computer sent media this app cannot read.';
export const damagedMedia = 'The media arrived damaged and is not shown.';

const hex = (bytes: Uint8Array) =>
	[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');

/** Decodes media a computer sent, and refuses bytes that are not exactly what it said it sent. */
export async function remoteBinary(value: RemoteBinary): Promise<Uint8Array> {
	if (value?.encoding !== 'base64' || typeof value.data !== 'string')
		throw new Error(unreadableMedia);
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = Uint8Array.from(atob(value.data), (character) => character.charCodeAt(0));
	} catch {
		throw new Error(unreadableMedia);
	}
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	if (bytes.length !== value.byteLength || hex(digest) !== value.sha256)
		throw new Error(damagedMedia);
	return bytes;
}
