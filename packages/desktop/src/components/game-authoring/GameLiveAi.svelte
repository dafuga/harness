<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hq2m7zd4bx -->
<script lang="ts">
	import Modal from '$shared/Modal.svelte';
	import Select from '$shared/Select.svelte';
	import type { GameLiveAiProps as Props } from './GameLiveAi.types';
	/**
	 * The live AI video control: one button opens a dialog that holds the model, the price, the
	 * start or stop control and the reason it is off, so the preview keeps only its movement.
	 */
	let {
		models,
		choice = $bindable(),
		limit,
		rate,
		available,
		busy,
		status,
		error,
		start,
		stop
	}: Props = $props();
	let open = $state(false);
</script>

<hx-div class="live" data-harness-component="game-live-ai">
	<hx-button aria-haspopup="dialog" onclick={() => (open = true)}>Live AI video…</hx-button>
</hx-div>
<Modal title="Live AI video" variant="text" {open} onClose={() => (open = false)}>
	<hx-div class="dialog">
		<hx-p>Runs at most {limit} s, so it costs at most ${rate.toFixed(2)}.</hx-p>
		<Select label="AI video model" bind:value={choice} disabled={!available || busy}>
			{#each Object.entries(models) as [key, item] (key)}
				<hx-option value={key}>{item.label} · ${item.rate.toFixed(2)}/min</hx-option>
			{/each}
		</Select>
		{#if busy}
			<hx-button onclick={stop}>Stop AI video</hx-button>
		{:else}
			<hx-button class="gold" disabled={!available} onclick={start}>Start AI video</hx-button>
		{/if}
		{#if status}<hx-p role="status">{status}</hx-p>{/if}
		{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	</hx-div>
</Modal>

<style>
	.dialog {
		display: grid;
		gap: var(--hx-space-12);
		justify-items: start;
		min-width: 0;
	}
</style>
