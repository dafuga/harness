// @harness-uid u_gvqtr5mdwv
import { writeFileSync } from 'node:fs';
import { deriveTrackerGuestKey } from '../../../adapters/agents-providers/module-task-runner-adapter/dockerTrackerGuestProtocol';
import type { TrackerGuestSigningKey } from '../../../adapters/agents-providers/module-task-runner-adapter/dockerTrackerGuest.types';
import type { TrackerGuestAuthWriter } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';

export function trackerGuestSigner(
	node: string,
	secret: string
): {
	signingKey: TrackerGuestSigningKey;
	write: TrackerGuestAuthWriter;
} {
	const signingKey: TrackerGuestSigningKey = (identity) =>
		deriveTrackerGuestKey(secret, { node, ...identity });
	const write: TrackerGuestAuthWriter = ({ path, itemId, runId, apiPort, key: attemptKey }) => {
		const key = signingKey({ itemId, runId, attemptKey });
		try {
			writeFileSync(path, JSON.stringify({ itemId, runId, apiPort, key: key.toString('hex') }), {
				flag: 'wx',
				mode: 0o600
			});
		} finally {
			key.fill(0);
		}
	};
	return { signingKey, write };
}
