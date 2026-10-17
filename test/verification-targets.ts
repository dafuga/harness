import { resolve } from 'node:path';
import { registeredVerificationScopes } from './registered-verification-scopes';
import { planReadsVerificationTests } from './plan-reads-verification-scopes';
export interface VerificationTarget {
	scenario: string;
	package: string;
	runner: 'vitest' | 'playwright';
	target: string;
	tests: Record<string, string>;
	states: string[];
}
export interface VerificationScope {
	package: string;
	vitest: Record<string, Record<string, string>>;
	playwright: Record<string, string[]>;
}
const scopes: Record<string, VerificationScope> = {
	...registeredVerificationScopes,
	'runtime-evidence-ui': {
		package: 'desktop',
		vitest: {},
		playwright: {
			'tests/e2e/ui-evidence-screens.spec.ts': ['screen-interaction'],
			'tests/e2e/ui-evidence-behavior.spec.ts': ['behavior-interaction'],
			'tests/e2e/ui-evidence-states.spec.ts': ['state-interaction'],
			'tests/e2e/ui-evidence-review.spec.ts': ['review-interaction']
		}
	},
	'planning-artifacts': {
		package: 'planning',
		vitest: {
			...planReadsVerificationTests,
			'test/planning-canonical.test.ts': {
				'canonical IDs stay exact across plans, threads and revision history':
					'repository-isolation',
				'refuses unattested IDs, canonical category mismatches and traversal':
					'repository-isolation'
			},
			'test/planning-change.test.ts': {
				'notes-only approved changes bind exact current approval and record cancellation':
					'immutable-history'
			},
			'test/planning-conflicts.test.ts': {
				'Git index locks refuse mutations without advancing HEAD or leaving planning files':
					'repository-isolation',
				'PNG designs require usable Git LFS filters without mutating repository state on refusal':
					'repository-isolation'
			},
			'test/planning-history.test.ts': {
				'branch snapshots and ancestry history contain only the selected entity':
					'immutable-history',
				'rejects changed historical message prefix even with a recomputed current hash chain':
					'immutable-history'
			},
			'test/planning-images.test.ts': {
				'LFS image threads retain original revision, verify bytes, and expose missing content':
					'immutable-history'
			},
			'test/planning-integration.test.ts': {
				'headless versions preserve staged work and invalidate exact approvals without active manifests':
					'immutable-history',
				'serializes concurrent writes and rejects traversal and dirty artifact collisions':
					'repository-isolation',
				'rejects committed immutable tampering and symlink destinations': 'immutable-history'
			},
			'test/utils/plan-data.test.ts': {
				'canonical data ignores object insertion order but preserves array order':
					'repository-isolation'
			},
			'test/utils/plan-image-codec.test.ts': {
				'decodes complete PNG and rejects damaged compressed image content': 'immutable-history'
			},
			'test/utils/plan-validate.test.ts': {
				'identities and rectangles reject traversal and out-of-image coordinates':
					'repository-isolation'
			},
			'test/planning-registry.test.ts': {
				'actual planning metadata stays outside active indexing for all five draft categories':
					'repository-isolation',
				'dirty or invalid registry configuration is never overwritten or committed':
					'repository-isolation',
				'existing formatter ignores protect immutable artifacts without hiding source':
					'repository-isolation',
				'dirty formatter ignores refuse planning without changing repository state':
					'repository-isolation'
			}
		},
		playwright: {}
	},
	'desktop-project-runs': {
		package: 'desktop',
		vitest: {
			'test/cli-integration.test.ts': {
				'codex-none refuses text or errors as image success': 'cli-boundaries',
				'codex-error refuses text or errors as image success': 'cli-boundaries',
				'codex-mismatch rejects false success': 'cli-boundaries',
				'claude-mismatch rejects false success': 'cli-boundaries',
				'claude-error rejects false success': 'cli-boundaries',
				'codex-hang cancellation kills only the owned process group': 'cli-boundaries',
				'claude-hang cancellation kills only the owned process group': 'cli-boundaries',
				'Codex initializes subscription RPC, discovers models and confines public turn events':
					'cli-boundaries',
				'completed image returns PNG bytes and transmits its original local image reference':
					'cli-boundaries',
				'Claude uses requested model, project cwd, stdin and subscription-only environment':
					'cli-boundaries'
			},
			'test/catalog-listing.test.ts': {
				'implemented pages select their declared screenshot rather than an absent planning image':
					'project-scope',
				'the tip lists every ordinary entity and no page manifest that only loads for an address':
					'project-scope',
				'what is left out of the list is still opened by its identity, with its sources and history':
					'project-scope',
				'the same identity is listed at the earlier commit where it renders, as it was there':
					'project-scope',
				'of the registry of this repository, the pages the explorer lists are listed and its route loaders are not':
					'project-scope'
			},
			'test/project-integration.test.ts': {
				'project selection and slash branches retain full ancestry and explicit historical views are immutable':
					'project-scope',
				'catalog shows source size and relationships without leaking source bodies or inventing verification':
					'project-scope',
				'planning drafts stay separate from canonical registry and immutable approvals bind only their original version':
					'project-scope',
				'existing canonical entities gain bound plans without duplicate draft identities':
					'project-scope'
			},
			'test/run-integration.test.ts': {
				'Plan uses read-only CLI and saves a committed immutable version without claiming verification':
					'plan-change',
				'approval alone never runs and Change records untracked and previously dirty source deltas':
					'plan-change',
				'stale approval is rejected before agent execution': 'plan-change',
				'image generation failure creates no invented image or successful completion':
					'plan-change',
				'failed Change never records a completed outcome': 'plan-change',
				'cancelled Change records cancellation and cannot cancel another run ID': 'plan-change',
				'observed host writes retain actual absolute path and hashes in committed change history':
					'plan-change',
				'visual provenance stores actual image orchestration model and exact full generator prompt':
					'plan-change',
				'Plan refuses a generation whose expected latest version changed while the image was running':
					'plan-change'
			},
			'test/backend-boundaries.test.ts': {
				'remote pages and child frames cannot use the project bridge': 'project-scope',
				'IPC refuses unknown operations, invalid regions and unapproved changes': 'project-scope',
				'subscription subprocesses omit API overrides without changing the parent':
					'cli-boundaries',
				'private reasoning is never forwarded to the renderer': 'cli-boundaries'
			}
		},
		playwright: {}
	},
	'desktop-renderer': {
		package: 'desktop',
		vitest: {
			'test/stores/workspace.test.ts': {
				'preview cannot open or navigate without the native bridge': 'workspace-state',
				'historical paths preserve encoded branch, full commit, actual tip and entity identity':
					'workspace-state',
				'explicit current-tip commit stays pinned through navigation until returning to branch tip':
					'workspace-state'
			}
		},
		playwright: {
			'tests/e2e/ui-workspace.spec.ts': ['renderer-fixtures'],
			'tests/e2e/ui-catalog-listing.spec.ts': ['catalog-listing'],
			'tests/e2e/ui-designs.spec.ts': ['renderer-fixtures'],
			'tests/e2e/ui-entity-usage.spec.ts': ['entity-usage'],
			'tests/e2e/ui-entity-usage-viewports.spec.ts': ['entity-usage'],
			'tests/e2e/ui-function-examples.spec.ts': ['function-examples-ui'],
			'tests/e2e/fixed-navigation.spec.ts': ['fixed-navigation']
		}
	},
	'desktop-native': {
		package: 'desktop',
		vitest: {},
		playwright: { 'tests/e2e/native-desktop.spec.ts': ['native-ipc', 'native-isolation'] }
	}
};
export function verificationTarget(
	scenario: string,
	runner: string,
	target: string,
	cwd: string
): VerificationTarget {
	const scope = scopes[scenario];
	const tests = runner === 'vitest' ? scope?.vitest[target] : undefined;
	let states = tests ? [...new Set(Object.values(tests))] : undefined;
	if (runner === 'playwright') states = scope?.playwright[target];
	if (!scope || !states || !atVerificationPackage(scope, cwd))
		throw new Error('Unknown verification scenario, runner, target or package');
	return {
		scenario,
		package: scope.package,
		runner: runner as 'vitest' | 'playwright',
		target,
		tests: tests ?? {},
		states
	};
}

/** Root evidence belongs to this checkout; workspace evidence retains its declared package. */
function atVerificationPackage(scope: VerificationScope, cwd: string): boolean {
	if (scope.package === 'root') return resolve(cwd) === resolve(import.meta.dirname, '..');
	return cwd.replaceAll('\\', '/').endsWith(`/packages/${scope.package}`);
}
