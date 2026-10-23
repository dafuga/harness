/** A whole device identity, which is the hash of its key, in groups a person can compare. */
/** @pure */
export function identityLabel(deviceId: string): string {
	return (deviceId.match(/.{1,4}/g) ?? []).join(' ');
}
