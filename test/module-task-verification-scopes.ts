import type { VerificationScope } from './verification-targets';

/** Each declared task capture runs one registered file and retains its actual assertions. */
export const moduleTaskVerificationScopes: Record<string, VerificationScope> = {
	'module-tasks': {
		package: 'root',
		vitest: {
			'test/adapters/agents-providers/provider-session.test.ts': {
				'pre-request refusal sends no upstream call and preserves scoped authentication':
					'context-rotation',
				'an emergency context reading stops the run instead of rotating again': 'context-rotation',
				'a malformed completed stream fails while retaining available token usage':
					'context-rotation',
				'Codex reads only its own appended rollout and distinguishes peak context from total usage':
					'context-rotation',
				'Claude measures cache-inclusive context at message start and counts a streamed message once':
					'context-rotation'
			},
			'test/commands/agents-providers/task-orchestration.test.ts': {
				'orchestration rejects context settings above the default before running a provider':
					'context-rotation'
			},
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
				'static apps scaffold a prerendered build while default apps use adapter-auto':
					'contract-admission',
				'project creation writes a static app and rejects unsupported adapter requests before writing':
					'contract-admission',
				'generated app code and testing foundations obey their formatter and lint settings':
					'contract-admission',
				'generated lib code and testing foundations obey their formatter and lint settings':
					'contract-admission'
			},
			'test/adapters/agents-providers/module-task-runner.test.ts': {
				'task limits use positive integers and fall back for invalid or unset values':
					'assigned-worker',
				'Claude and Codex launch exact models and intelligence without shell interpolation':
					'assigned-worker',
				'successful public Claude CLI events retain requested model and summary': 'assigned-worker',
				'fallback eligibility uses structured quota signals (quota)': 'quota-fallback',
				'fallback eligibility uses structured quota signals (authentication)': 'quota-fallback',
				'fallback eligibility uses structured quota signals (text-only-quota)': 'quota-fallback',
				'a completed CLI run that reports another model is rejected': 'contract-admission',
				'public claude usage is retained without guessing absent counters': 'usage-pricing',
				'public codex usage is retained without guessing absent counters': 'usage-pricing',
				'failed turns preserve available usage for cost attribution': 'usage-pricing',
				'"Claude task failed" is a named ModuleTaskRunError': 'contract-admission',
				'"Claude quota exhausted." is a named ModuleTaskRunError': 'contract-admission',
				'"Claude was denied a required tool" is a named ModuleTaskRunError': 'contract-admission',
				'"Claude ran a different model." is a named ModuleTaskRunError': 'contract-admission',
				'"Codex task failed" is a named ModuleTaskRunError': 'contract-admission',
				'"Codex ran a different model." is a named ModuleTaskRunError': 'contract-admission'
			},
			'test/adapters/agents-providers/managed-provider-docker.test.ts': {
				'Docker command preserves argv and uses a task-owned workspace volume and bounded tmpfs':
					'provider-platform',
				'only explicit Linux uses a pinned local image, and macOS tooling requires Darwin':
					'provider-platform'
			},
			'test/adapters/agents-providers/module-task-worktree-adapter.test.ts': {
				'submission checkpoint preserves source HEAD and both staged and unstaged work':
					'contract-admission',
				'a task worktree whose HEAD moved is refused with its named error': 'contract-admission'
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
				'model choice ranks complete first-attempt samples inside each estimated difficulty':
					'run-records',
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
				'auto quota rejected by codex falls back to the other provider': 'quota-fallback',
				'auto quota rejected by claude falls back to the other provider': 'quota-fallback',
				'API quotes use versioned rates and preserve unknown models (claude-haiku-5-5, 100 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (claude-haiku-5-5, 100001 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (gpt-6.1-sol, 100 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (gpt-6-astra, 100 input)':
					'usage-pricing',
				'API quotes use versioned rates and preserve unknown models (unpriced-model, 100 input)':
					'usage-pricing'
			},
			'test/module-tasks.e2e.test.ts': {
				'Harness hands off before the next request could cross 190000 tokens': 'context-rotation',
				'Harness owns and rotates the orchestrator before a fresh session resumes its checkpoint':
					'context-rotation',
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
			'test/services/agents-providers/module-task-acceptance.test.ts': {
				'acceptance refuses a submission without a passing record of a commit that carries it':
					'verified-acceptance',
				'a verified submission is accepted once and a resent verdict replays the recorded one':
					'verified-acceptance'
			},
			'test/services/agents-providers/module-task-preflight.test.ts': {
				'an exhausted provider quota blocks dispatch until its reset without charging an attempt':
					'dispatch-preflight',
				'a cooldown without a reported reset pauses for the default window only':
					'dispatch-preflight',
				'missing required tools block only the tasks that need them': 'dispatch-preflight',
				'an unwritable task worktree directory blocks before any claim (EPERM, EACCES)':
					'dispatch-preflight',
				'a task queued after the preflight read is not claimed until its own preflight':
					'dispatch-preflight'
			},
			'test/services/agents-providers/module-task-run-metrics.test.ts': {
				'per-model metrics separate machine and quota failures from the model quality rate':
					'run-records'
			},
			'test/module-task-dispatch.e2e.test.ts': {
				'a Claude quota rejection pauses the next dispatch with exit 75 and no provider call':
					'dispatch-preflight'
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
