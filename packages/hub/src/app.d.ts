// @harness-uid u_fgcaimnxut
// The package tsconfig replaces SvelteKit's `include`, so its generated `$env` modules are named here.
/// <reference path="../.svelte-kit/ambient.d.ts" />
import type { D1Database, DurableObjectNamespace, R2Bucket } from '@cloudflare/workers-types';
import type { AuthEnv } from './models/accounts-access/HubAuth.types';

declare global {
	namespace App {
		interface Platform {
			/** Dedicated hub bindings. Every value is optional; a missing one disables its feature. */
			env: AuthEnv & {
				HARNESS_COLLABORATION_OWNER?: string;
				HARNESS_COLLABORATION_REPO?: string;
				HARNESS_RELAY_ORIGIN?: string;
				DB?: D1Database;
				CACHE?: R2Bucket;
				/** Private Reports R2 bucket for reading published feature videos. */
				EVIDENCE?: R2Bucket;
				/** Private bucket of vetted release archives. Read only by the Mac download route. */
				DOWNLOADS?: R2Bucket;
				/** Provisioned object key of the vetted Mac archive, e.g. releases/mac-arm64/<sha>/Harness.zip. */
				HARNESS_MAC_DOWNLOAD_KEY?: string;
				REMOTE_HOSTS?: DurableObjectNamespace;
			};
		}
	}
}

export {};
