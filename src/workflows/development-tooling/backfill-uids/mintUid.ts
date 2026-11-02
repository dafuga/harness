// @harness-uid u_an4bempa7l
import { randomBytes } from 'node:crypto';
import { uidPattern } from '../../../core/development-tooling/unitTypes';

const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

/** A fresh unit uid that no unit in `taken` holds. */
export function mintUid(taken: Set<string>): string {
	for (;;) {
		const letters = [...randomBytes(10)].map((byte) => alphabet[byte % 32]).join('');
		const uid = `u_${letters}`;
		if (uidPattern.test(uid) && !taken.has(uid)) {
			taken.add(uid);
			return uid;
		}
	}
}
