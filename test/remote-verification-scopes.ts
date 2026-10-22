import type { VerificationScope } from './verification-targets';

/** Explicit acceptance targets; a different test or package cannot claim these states. */
export const remoteVerificationScopes: Record<string, VerificationScope> = {
	'remote-mobile-native': {
		package: 'desktop',
		vitest: {
			'test/ios-simulator-build.test.ts': {
				'normal Debug simulator product has usable signing without fixture exceptions':
					'native-build',
				'normal Release simulator product has usable signing without fixture exceptions':
					'native-build',
				'Release refuses fixture exceptions before a build can start': 'native-build'
			},
			'test/ios-native-profile.test.ts': {
				'Swift reproduces the backend encrypted protocol vectors': 'native-profile',
				'native Debug and Release verify authority, redirects, caching and replay':
					'native-profile',
				'Swift source remains within the declared native shape limits': 'native-profile'
			},
			'test/ios-cache-authority.test.ts': {
				'native late reads and denial cannot retain project access': 'native-authority'
			},
			'test/ios-cache-listing.test.ts': {
				'a catalog the phone kept before route loaders were left out is not answered, and nothing else is lost':
					'native-authority'
			}
		},
		playwright: {}
	},
	'remote-desktop-boundaries': {
		package: 'desktop',
		vitest: {
			'test/adapters/agent-http.test.ts': {
				'an uncertain start keeps its identity through unrelated errors and retries its original payload':
					'local-authority',
				'temporary polling failure retains the run until its confirmed terminal event':
					'local-authority',
				'a definitive polling denial stops the run subscription': 'local-authority'
			},
			'test/utils/repository-lease.test.ts': {
				'a repository lease rejects contention and admits a new owner after release':
					'local-authority',
				'helper death aborts the lease but its parent fence holds until explicit release':
					'local-authority'
			},

			'test/remote-human-approval.test.ts': {
				'a concurrent valid request cannot replace the phone already displayed': 'human-authority',
				'approval after project discovery stays bound to the displayed phone': 'human-authority'
			},
			'test/remote-pinned-revocation.test.ts': {
				'an explicitly pinned current-tip snapshot cannot authorize a mutation':
					'revision-authority',
				'revoking a session during project opening prevents the deferred write': 'revocation',
				'revoking during provider preparation cannot append a request or start a CLI': 'revocation'
			},
			'test/remote-relay-workerd.test.ts': {
				'a phone pairs, reads, runs and is revoked through the relay, which never holds plaintext':
					'encrypted-relay',
				'suspension is offline at the relay; waking resumes the same session over a new channel':
					'relay-reconnect'
			},
			'test/remote-enable-lifecycle.test.ts': {
				'disabling during registration cannot enable or start the host later': 'host-authority',
				'quitting during registration cannot persist or start the host later': 'host-authority'
			},
			'test/utils/desktop-ipc.test.ts': {
				'the main process answers one IPC channel: the ticket of the caller, or a refusal':
					'local-authority',
				'only the top frame of the app page in this window is a trusted sender': 'local-authority'
			},
			'test/local-transport-bounds.test.ts': {
				'a socket opens only with a fresh ticket, from the app page, on the transport path':
					'local-authority',
				'a ticket is short-lived, and the number of sockets is bounded': 'local-authority',
				'frames that break the bounds close the socket and reach no operation': 'local-authority',
				'a request that never completes is never performed': 'local-authority',
				'the app page may send more than a phone request, up to the local bound, and is answered':
					'local-authority'
			},
			'test/local-transport.test.ts': {
				'the bridge works over a socket that only this machine can reach': 'local-socket',
				'an image of more than a mebibyte crosses the socket in bounded frames and arrives intact':
					'local-socket',
				'two large answers take turns on the socket and a small one does not wait for them':
					'local-socket',
				'each window is its own client: its own project, its own run events, one repository lock':
					'local-socket',
				'a reload keeps the session of its window; closing the window ends its socket and its run only':
					'local-socket',
				'a game of nearly a mebibyte crosses to the main process in bounded frames and reopens':
					'local-socket',
				'the control port travels over the same socket, with exactly what the page gave':
					'local-socket',
				'repeated concurrent listens reuse one listener and closing releases it': 'local-socket'
			},
			'test/local-transport-teardown.test.ts': {
				'a page socket whose handshake is never answered is still connecting when its test ends':
					'local-socket',
				'the teardown of that test cancelled the socket and told its page that the backend is gone':
					'local-socket',
				'the teardown returns only once the socket it cancelled has closed': 'local-socket',
				'an error the teardown did not cause is thrown by it, once the socket has closed':
					'local-socket',
				'the same error raised before the teardown is not its doing, and is thrown as well':
					'local-socket'
			}
		},
		playwright: {}
	},
	'remote-mobile-ui': {
		package: 'desktop',
		vitest: {},
		playwright: {
			'tests/e2e/ui-remote-phone.spec.ts': ['phone-interaction'],
			'tests/e2e/ui-remote-host.spec.ts': ['desktop-interaction'],
			'tests/e2e/ui-remote-cache.spec.ts': ['cached-interaction'],
			'tests/e2e/ui-remote-scan.spec.ts': ['scan-interaction'],
			'tests/e2e/ui-remote-tablet.spec.ts': ['tablet-interaction']
		}
	}
};
