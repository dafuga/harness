<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { ProviderState, ProviderId, RunMode } from '../models/Desktop.types';
	let {
		providers,
		writable,
		approved,
		running,
		send
	}: {
		providers: ProviderState[];
		writable: boolean;
		approved: boolean;
		running: boolean;
		send: (request: {
			text: string;
			mode: RunMode;
			provider: ProviderId;
			model: string;
			effort: string | null;
		}) => Promise<boolean>;
	} = $props();
	let text = $state('');
	let mode = $state<RunMode>('plan');
	let provider = $state<ProviderId>('codex');
	let model = $state('');
	let effort = $state('');
	const current = $derived(providers.find((p) => p.id === provider));
	const selected = $derived(current?.models.find((m) => m.id === model));
	const disabled = $derived(
		!writable ||
			running ||
			!current?.available ||
			!model ||
			!text.trim() ||
			(mode === 'change' && !approved)
	);
	$effect(() => {
		if (!current?.models.some((m) => m.id === model))
			model = current?.models.find((m) => m.isDefault)?.id || current?.models[0]?.id || '';
	});
	$effect(() => {
		if (!selected?.efforts.includes(effort))
			effort = selected?.defaultEffort || selected?.efforts[0] || '';
	});
	async function submit() {
		if (disabled) return;
		const sent = await send({ text: text.trim(), mode, provider, model, effort: effort || null });
		if (sent) text = '';
	}
</script>

<form
	class="composer"
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<textarea
		aria-label="Message"
		placeholder="Describe the next design…"
		bind:value={text}
		rows="3"
		disabled={!writable || running}
	></textarea>
	<div class="mode-options" aria-label="Request mode">
		<button type="button" class:active={mode === 'plan'} onclick={() => (mode = 'plan')}
			>Plan</button
		><button
			type="button"
			class:active={mode === 'change'}
			disabled={!approved}
			title={approved
				? 'Implement the exact approved design'
				: 'Approve the current exact design first'}
			onclick={() => (mode = 'change')}>Change</button
		>
	</div>
	<div class="provider-options">
		{#each providers as item (item.id)}<button
				type="button"
				class:active={provider === item.id}
				disabled={!item.available}
				title={item.reason || item.label}
				onclick={() => (provider = item.id)}>{item.label}</button
			>{/each}
	</div>
	<div class="composer-bottom">
		<Select label="Model" bind:value={model} disabled={!current?.available}
			>{#each current?.models || [] as choice (choice.id)}<option value={choice.id}
					>{choice.label}</option
				>{/each}</Select
		><Select label="Reasoning effort" bind:value={effort} disabled={!selected?.efforts.length}
			>{#each selected?.efforts || [] as choice (choice)}<option value={choice}>{choice}</option
				>{/each}{#if !selected?.efforts.length}<option value="">Default effort</option>{/if}</Select
		><button class="primary send" aria-label={`Send ${mode}`} {disabled}>➤</button>
	</div>
	{#if current?.reason}<small>{current.reason}</small>{/if}{#if !providers.length}<small
			>No agent provider available.</small
		>{/if}
</form>
