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
				REMOTE_HOSTS?: DurableObjectNamespace;
			};
		}
	}
}

export {};
