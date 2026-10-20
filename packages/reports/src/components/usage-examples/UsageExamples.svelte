<script lang="ts">
	import type { UsageExample } from '../../../../../src/utils/unit-documentation/unitDocumentation';
	let { examples, setup }: { examples: UsageExample[]; setup?: string } = $props();
	import { compact, usageExamples, type UsageChange } from './usageExamples';
	let results = $derived(usageExamples(examples));
	const number = (position: number) => String(position + 1).padStart(2, '0');
	let expanded = $state(false);
</script>

<!-- Each authored call beside what it should give, and how that differs from the first. -->
<div class="cases">
	{#if setup}
		<details>
			<summary>Shared setup used by these calls</summary>
			<pre><code>{setup}</code></pre>
		</details>
	{/if}
	<table>
		<thead>
			<tr>
				<th scope="col">Example</th>
				<th scope="col">Call</th>
				<th scope="col">Expected output</th>
			</tr>
		</thead>
		<tbody>
			{#each examples as example, position (position)}
				{@const { outcome, changes } = results[position]}
				<tr>
					<th scope="row">
						<span class="ux-label">Example {number(position)}</span>
						<span>{example.name}</span>
						{#if example.description}<span class="ux-note">{example.description}</span>{/if}
					</th>
					<td data-label="Call">
						{#if example.call}
							<pre><code>{example.call}</code></pre>
						{:else}
							<p class="ux-note"><em>Call not documented</em> · input as documented</p>
							<pre><code>{compact(example.input)}</code></pre>
						{/if}
					</td>
					<td data-label="Expected output">
						{#if outcome.failed}<p class="ux-label ux-accent">Expected error</p>{/if}
						<pre><code>{compact(outcome.value)}</code></pre>
						{#if position && changes.length}
							{@render difference(changes)}
						{:else if position}
							<p class="ux-note">Same output as Example 01</p>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<details bind:open={expanded}>
		<summary>Full example values</summary>
		{#if expanded}<pre><code>{JSON.stringify(examples, null, 2)}</code></pre>{/if}
	</details>
</div>

{#snippet difference(changes: UsageChange[])}
	<div class="ux-diff">
		<p class="ux-label ux-accent">Output changes from Example 01</p>
		{#each changes as { field, was, now, kinds }, index (index)}
			<p class="ux-note">
				{#if field !== undefined}<strong>{field}</strong>{/if}
				{#if kinds}<em>{kinds[0]}</em>{/if}
				{#if was === undefined}<em>absent</em>{:else}<code>{compact(was)}</code>{/if}
				<span class="ux-arrow">→</span>
				{#if kinds}<em>{kinds[1]}</em>{/if}
				{#if now === undefined}<em>absent</em>{:else}<code>{compact(now)}</code>{/if}
			</p>
		{/each}
	</div>
{/snippet}

<style>
	.cases {
		container-type: inline-size;
		display: grid;
		gap: 12px;
	}
	table {
		width: 100%;
		border-spacing: 0;
	}
	tr {
		display: grid;
		grid-template-columns: minmax(0, 13rem) minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 8px 20px;
		padding: 14px 0;
		border-top: 1px solid #22394a;
	}
	th,
	td {
		display: grid;
		align-content: start;
		gap: 6px;
		min-width: 0;
		padding: 0;
		text-align: left;
	}
	tbody th {
		gap: 2px;
		font-size: 0.92rem;
		color: #edf4fa;
	}
	thead th,
	td::before,
	.ux-label {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		color: #8fa6b8;
	}
	.ux-note {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 400;
		color: #9aafc0;
	}
	.cases code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}
	pre {
		margin: 0;
		padding: 10px 12px;
		border: 1px solid #263d4d;
		border-radius: 8px;
		background: #0b1821;
		white-space: pre-wrap;
		color: #d5e4ef;
	}
	details pre {
		max-height: 24rem;
		margin-top: 8px;
		overflow: auto;
	}
	summary {
		cursor: pointer;
		font-size: 0.8rem;
		color: #b6cad9;
	}
	.ux-diff {
		display: grid;
		gap: 4px;
		padding: 8px 10px;
		border-left: 2px solid var(--ex-gold, #f3c33b);
		background: rgb(243 195 59 / 6%);
	}
	.cases .ux-accent,
	.ux-arrow ~ * {
		color: var(--ex-gold, #f3c33b);
	}
	@container (max-width: 900px) {
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		tr {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		tbody th {
			grid-column: 1 / -1;
		}
		td::before {
			content: attr(data-label);
		}
	}
	@container (max-width: 560px) {
		tr {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
