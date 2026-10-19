<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { UnitDocumentation } from '../../../../src/utils/unit-documentation/unitDocumentation';
	import EntityCases from './entity-cases/EntityCases.svelte';
	let {
		documentation,
		verification
	}: {
		/** What a committed document says of a unit's use; absent when none was read. */
		documentation?: UnitDocumentation;
		verification?: Snippet;
	} = $props();
	let examples = $derived(documentation?.examples ?? []);
	let opened = $state(false);
</script>

<!-- How a unit is meant to be used, as written down: what it is given and should give back. -->
<section class="ex-card">
	<h2>Examples</h2>
	<p class="ex-note">
		Documented uses and the results they are expected to give, not recorded test results.
	</p>
	{#if examples.length}
		<EntityCases {examples} />
	{:else}
		<p class="ex-gap">No usage examples are documented at this commit.</p>
		{#if documentation?.gap}<p class="ex-gap">{documentation.gap}</p>{/if}
	{/if}
	{#if documentation?.text}
		<details>
			<summary>Committed document</summary>
			<pre>{documentation.text}</pre>
		</details>
	{/if}
</section>
{#if verification}
	<details bind:open={opened}>
		<summary>Recorded tests and verification</summary>
		{#if opened}{@render verification()}{/if}
	</details>
{/if}

<style>
	.ex-card {
		min-width: 0;
		padding: 20px;
		border: 1px solid #2c4254;
		border-radius: 14px;
		background: #0d1c27;
		color: #d5e4ef;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 1.1rem;
		color: #edf4fa;
	}
	.ex-note {
		margin: 0 0 16px;
		font-size: 0.85rem;
		color: #9aafc0;
	}
	.ex-gap {
		margin: 0 0 8px;
		font-size: 0.9rem;
		color: #b6cad9;
	}
	summary {
		cursor: pointer;
		padding: 8px 0;
		font-size: 0.8rem;
		color: #b6cad9;
	}
	pre {
		max-width: 100%;
		max-height: 24rem;
		margin: 0;
		padding: 14px;
		overflow: auto;
		border: 1px solid #263d4d;
		border-radius: 8px;
		background: #0b1821;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font:
			0.78rem/1.6 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		color: #d5e4ef;
	}
</style>
