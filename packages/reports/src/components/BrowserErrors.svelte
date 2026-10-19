<script lang="ts">
	import type { BrowserDiagnostic } from '../../../../src/core/browserDiagnostics';
	import { browserErrorRows, type BrowserErrorRow } from '../utils/browserErrorRows';
	let { diagnostics }: { diagnostics?: BrowserDiagnostic[] } = $props();
	const location = (error: BrowserErrorRow) =>
		error.source
			? `${error.source}${error.line === undefined ? '' : `:${error.line + 1}:${(error.column ?? 0) + 1}`}`
			: null;
</script>

{#if diagnostics?.length}
	<div class="browser-errors" role="group" aria-label="Browser errors">
		<details>
			<summary
				>Browser errors · {diagnostics.reduce(
					(sum, item) => sum + browserErrorRows(item).length,
					0
				)} entries</summary
			>
			{#each diagnostics as run, index (index)}
				<section aria-label={run.test}>
					<p><strong>{run.test}</strong></p>
					<p class="metadata">
						{run.file} · {run.project || run.browser || 'Browser'} · Retry {run.retry}
					</p>
					<ol>
						{#each browserErrorRows(run) as error, position (position)}
							<li>
								<p>
									<strong>{error.status}</strong> · {error.type === 'console'
										? 'console.error'
										: 'Uncaught exception'}
								</p>
								<pre>{error.message}</pre>
								{#if error.reason}<p>{error.reason}</p>{/if}
								{#if location(error)}<p class="metadata">Source: {location(error)}</p>{/if}
								{#if error.page}<p class="metadata">Page: {error.page}</p>{/if}
								{#if error.stack}<pre>{error.stack}</pre>{/if}
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		</details>
	</div>
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
		margin: 8px 0;
	}
	ol {
		padding-left: 24px;
	}
	li {
		margin: 12px 0;
	}
	.metadata {
		font-size: 0.85rem;
		opacity: 0.8;
	}
	pre {
		margin: 8px 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8rem;
	}
</style>
