// The package tsconfig replaces SvelteKit's `include`, so its generated `$env` modules are named here.
/// <reference path="../.svelte-kit/ambient.d.ts" />
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { AuthEnv } from './models/HubAuth.types';

declare global {
	namespace App {
		interface Platform {
			/** Dedicated hub bindings. Every value is optional; a missing one disables its feature. */
			env: AuthEnv & {
				HARNESS_COLLABORATION_OWNER?: string;
				HARNESS_COLLABORATION_REPO?: string;
				DB?: D1Database;
				CACHE?: R2Bucket;
			};
		}
	}
}

export {};
