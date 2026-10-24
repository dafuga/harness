<!-- @harness-tier molecule -->
<!-- @harness-atoms ../atoms -->
<script lang="ts">
	import type { BrowserDiagnostic } from '../../../../../../src/core/browserDiagnostics';
	import { browserErrorRows } from './browserErrorRows';
	import { type BrowserErrorRow } from '../../../utils/shared-primitives/browserErrorRows';
	let { diagnostics }: { diagnostics?: BrowserDiagnostic[] } = $props();
	const location = (error: BrowserErrorRow) =>
		error.source
			? `${error.source}${error.line === undefined ? '' : `:${error.line + 1}:${(error.column ?? 0) + 1}`}`
			: null;
</script>

{#if diagnostics?.length}
	<hx-div class="browser-errors" role="group" aria-label="Browser errors">
		<hx-details>
			<hx-summary
				>Browser errors · {diagnostics.reduce(
					(sum, item) => sum + browserErrorRows(item).length,
					0
				)} entries</hx-summary
			>
			{#each diagnostics as run, index (index)}
				<hx-section aria-label={run.test}>
					<hx-p><hx-strong>{run.test}</hx-strong></hx-p>
					<hx-p class="metadata">
						{run.file} · {run.project || run.browser || 'Browser'} · Retry {run.retry}
					</hx-p>
					<hx-ol>
						{#each browserErrorRows(run) as error, position (position)}
							<hx-li>
								<hx-p>
									<hx-strong>{error.status}</hx-strong> · {error.type === 'console'
										? 'console.error'
										: 'Uncaught exception'}
								</hx-p>
								<hx-pre>{error.message}</hx-pre>
								{#if error.reason}<hx-p>{error.reason}</hx-p>{/if}
								{#if location(error)}<hx-p class="metadata">Source: {location(error)}</hx-p>{/if}
								{#if error.page}<hx-p class="metadata">Page: {error.page}</hx-p>{/if}
								{#if error.stack}<hx-pre>{error.stack}</hx-pre>{/if}
							</hx-li>
						{/each}
					</hx-ol>
				</hx-section>
			{/each}
		</hx-details>
	</hx-div>
{/if}

<style>
	.browser-errors {
		min-width: 0;
		width: 100%;
		overflow-wrap: anywhere;
	}
	summary {
		cursor: pointer;
	}
	p {
		margin: var(--hx-space-8) 0;
	}
	ol {
		padding-left: var(--hx-space-24);
	}
	li {
		margin: var(--hx-space-12) 0;
	}
	.metadata {
		font-size: var(--hx-type-size-sm);
		opacity: var(--hx-opacity-secondary);
	}
	pre {
		margin: var(--hx-space-8) 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-compact);
	}
</style>
