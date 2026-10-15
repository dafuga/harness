<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	/**
	 * One icon opens the reasoning efforts the chosen model supports. A model that lists none runs
	 * at its own default, so the icon is then disabled rather than offering an effort it lacks.
	 */
	let { efforts, effort = $bindable() }: { efforts: string[]; effort: string } = $props();
	let trigger = $state<HTMLButtonElement>();
	let dialog = $state<HTMLDialogElement>();
	const tip = $derived(
		efforts.length ? `Reasoning effort: ${effort}` : 'Reasoning effort: model default'
	);
	async function open() {
		dialog?.showModal();
		await tick();
		dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
	}
	function choose(next: string) {
		effort = next;
		dialog?.close();
	}
	/** Escape closes the picker only, never the panel around it. */
	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		dialog?.close();
	}
</script>

<button
	bind:this={trigger}
	type="button"
	class="agent-icon"
	aria-label="Reasoning effort"
	aria-haspopup="dialog"
	title={tip}
	disabled={!efforts.length}
	onclick={open}><Icon name="reasoning" size={18} /></button
>
<dialog
	bind:this={dialog}
	class="agent-picker"
	aria-label="Reasoning effort"
	onclick={(event) => event.target === event.currentTarget && dialog?.close()}
	onkeydown={keydown}
	onclose={() => trigger?.focus()}
>
	<div class="agent-picker-body">
		{#each efforts as item (item)}<button
				type="button"
				class:active={item === effort}
				aria-pressed={item === effort}
				onclick={() => choose(item)}>{item}</button
			>{/each}
	</div>
</dialog>

<style>
	.agent-picker {
		width: min(220px, calc(100vw - 24px));
		max-height: min(420px, calc(100dvh - 24px));
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: inherit;
		overflow: auto;
	}
	.agent-picker::backdrop {
		background: rgb(3 26 40 / 0.6);
	}
	.agent-picker-body {
		display: grid;
		gap: 6px;
		padding: 14px;
	}
	.agent-picker-body button {
		justify-content: start;
		text-align: start;
	}
</style>
