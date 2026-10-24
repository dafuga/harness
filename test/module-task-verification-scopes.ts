import type { VerificationScope } from './verification-targets';

/** Each declared task capture runs one registered file and retains its actual assertions. */
export const moduleTaskVerificationScopes: Record<string, VerificationScope> = {
	'module-tasks': {
		package: 'root',
		vitest: {
			'test/analytics.test.ts': {
				'module task analytics retain model usage and count rejected completions once':
					'usage-pricing',
				'unreported module usage and unreviewed completions remain unknown': 'usage-pricing',
				'first assessed task attempt is attributed to its first author across revisions':
					'contract-admission',
				'cached checks, dry runs, unlinked and duplicate content are excluded':
					'contract-admission',
				'project and check kind separate identities and no tasks gives null rate':
					'contract-admission',
				'model filters retain the task first author instead of promoting a later revision':
					'contract-admission',
				'model and template names matching object properties still count correctly':
					'contract-admission'
			},
			'test/project-template.test.ts': {
				'generated element atoms preserve native compilation and emitted runtime source':
					'contract-admission',
				'app projects include SvelteKit and specification files': 'contract-admission',
				'library projects include Bun TypeScript test structure': 'contract-admission',
				'generated app code and configuration obey their formatter settings': 'contract-admission',
				'generated lib code and configuration obey their formatter settings': 'contract-admission'
			},
			'test/adapters/agents-providers/module-task-runner.test.ts': {
				'Claude and Codex launch exact models and intelligence without shell interpolation':
					'assigned-worker',
				'successful public Claude CLI events retain requested model and summary': 'assigned-worker',
				'fallback eligibility uses structured quota signals (quota)': 'quota-fallback',
				'fallback eligibility uses structured quota signals (authentication)': 'quota-fallback',
				'fallback eligibility uses structured quota signals (text-only-quota)': 'quota-fallback',
				'a completed CLI run that reports another model is rejected': 'contract-admission',
				'public claude usage is retained without guessing absent counters': 'usage-pricing',
				'public codex usage is retained without guessing absent counters': 'usage-pricing',
				'failed turns preserve available usage for cost attribution': 'usage-pricing'
			},
			'test/adapters/agents-providers/module-task-worktree-adapter.test.ts': {
				'submission checkpoint preserves source HEAD and both staged and unstaged work':
					'contract-admission'
			},
			'test/commands/agents-providers/module-task.test.ts': {
				'module task commands retain the existing evidence-based task check': 'contract-admission'
			},
			'test/repositories/agents-providers/module-task.test.ts': {
				'queue compare-and-swap retains simultaneous writers and commits without touching source HEAD':
					'contract-admission'
			},
			'test/services/agents-providers/module-task-analytics-service.test.ts': {
				'committed task history emits stable IDs and excludes raw prompt text':
					'contract-admission',
				'missing Codex cache-write counts produce a priced range rather than a guessed bill':
					'usage-pricing'
			},
			'test/services/agents-providers/module-task-worker.test.ts': {
				'module filters and assignment claims select once, then preserve changes for review':
					'contract-admission',
				'incomplete review commits a repair base, requeues once, and keeps prior work and contract':
					'reviewed-repairs'
			},
			'test/services/agents-providers/module-task.test.ts': {
				'admission rejects missing contracts, unknown modules and mutable task identities':
					'contract-admission',
				'retry preserves abandoned claims and refuses to steal an active owner': 'owner-recovery',
				'auto owns model and intelligence, while exact model choices retain their effort':
					'contract-admission',
				'API quotes use versioned rates and preserve unknown models (claude-haiku-5-5, 100 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (claude-haiku-5-5, 100001 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (unpriced-model, 100 input)':
					'usage-pricing'
			},
			'test/module-tasks.e2e.test.ts': {
				'module task creation requires a wanted contract and leaves source HEAD and edits intact':
					'contract-admission',
				'tasks share a stable goal-first prompt and keep their wanted contracts after a fresh fetch':
					'contract-admission',
				'assigned worker preserves explicit claude-haiku-5-5 intelligence high': 'assigned-worker',
				'assigned worker preserves explicit gpt-6-luna intelligence max': 'assigned-worker',
				'auto falls back to Luna 6 max only for confirmed Claude quota (quota)': 'quota-fallback',
				'auto falls back to Luna 6 max only for confirmed Claude quota (auth)': 'quota-fallback',
				'explicit Claude quota failure never silently substitutes another model': 'quota-fallback',
				'competing workers claim once and writes outside the module require review as failed':
					'owner-recovery'
			},
			'test/analytics-attribution.e2e.test.ts': {
				'failed commands and incomplete checks are recorded without supplied text':
					'contract-admission',
				'analytics write failures do not change the dry-run result': 'usage-pricing',
				'module task CLI reviews preserve one bounce and reconcile token costs idempotently':
					'reviewed-repairs'
			}
		},
		playwright: {}
	}
};
