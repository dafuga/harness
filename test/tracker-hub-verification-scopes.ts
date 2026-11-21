import type { VerificationScope } from './verification-targets';

export const trackerHubVerificationScopes: Record<string, VerificationScope> = {
	'tracker-hub-sync': {
		package: 'root',
		vitest: {
			'test/services/projects-sessions/tracker-hub-sync.test.ts': {
				'push receipt, duplicate retry and bounded pull preserve hub sequencing and operation authorship':
					'signed-push-retry-and-pull',
				'pull rewinds an ahead cursor immediately and omits absent due policy':
					'signed-push-retry-and-pull',
				'signed health reports the journal identity and tracks reported nodes without exposing mutable state':
					'health-and-peers',
				'authorization covers the method, exact target and raw POST bytes before any store is accessed':
					'unauthorized',
				'due permission passes the signed payload and reported node to the injected policy':
					'due-permission',
				'machine telemetry attributes samples and runs to the reported sender and returns fleet data':
					'fleet-telemetry'
			},
			'test/services/projects-sessions/tracker-hub-http.test.ts': {
				'push accepts a split UTF-8 body and rejects oversized streams before journal access':
					'request-errors',
				'canceling a partially delivered POST releases its reader before peer or journal effects':
					'request-errors',
				'malformed signed inputs return fixed client errors and leave the journal intact':
					'request-errors',
				'unexpected injected failures return a generic server error': 'request-errors'
			},
			'test/services/projects-sessions/tracker-hub-poll.test.ts': {
				'a committed push wakes concurrent long polls through a single journal subscription':
					'signed-push-wakes-two-pulls',
				'long-poll timeout caps the requested wait at 60 seconds and releases the journal subscription':
					'signed-push-wakes-two-pulls',
				'canceling one poll leaves others subscribed, and canceling the last avoids a journal reread':
					'signed-push-wakes-two-pulls'
			}
		},
		playwright: {}
	}
};
