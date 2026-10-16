const kinds = new Map([
	['image/png', 'screenshot'],
	['image/jpeg', 'screenshot'],
	['audio/wav', 'audio'],
	['audio/mpeg', 'audio'],
	['audio/mp4', 'audio'],
	['audio/ogg', 'audio'],
	['application/json', 'output'],
	['text/plain', 'output']
]);
export const unshownHostedArtifact = 'The hosted service sent a kind this app does not show.';
/** Only text may declare UTF-8; arbitrary MIME parameters and aliases are refused. */
export function hostedAttestation(stated: string) {
	const matched = /^([a-z]+\/[a-z0-9.+-]+)(?:\s*;\s*charset=utf-8)?$/i.exec(stated.trim());
	const type = matched?.[1].toLowerCase();
	const kind = type && kinds.get(type);
	if (!kind || !type || (kind !== 'output' && stated.includes(';')))
		throw new Error(unshownHostedArtifact);
	return { kind, mediaType: type };
}
