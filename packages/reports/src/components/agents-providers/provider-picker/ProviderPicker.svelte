<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Select from '../../shared-primitives/Select.svelte';
	import ProviderPickerCards from '../ProviderPickerCards.svelte';
	import { providerPickerClient } from './providerPickerClient';
	import { type PickerClient } from '../../../utils/agents-providers/providerPickerClient';
	import type { PickerSnapshot, SwitchRequest } from '../../../../../../src/core/pickerTypes';
	import type { ProviderSelection } from '../../../../../../src/core/pickerModelTypes';
	import '../../../lib/styles/provider-picker.css';
	let { label = 'Model picker' }: { label?: string } = $props();

	const providers: Record<string, string> = { openai: 'OpenAI', 'harness-claude': 'Claude' };

	let client = $state<PickerClient | null>(null);
	let snapshot = $state<PickerSnapshot | null>(null);
	let sessions = $state<SwitchRequest[] | null>(null);
	let provider = $state('openai');
	let model = $state('');
	let effort = $state('');
	let draftId = $state('');
	let boundId = $state('');
	let busy = $state('');
	let error = $state('');
	let closed = false;
	let seen = { provider: '', model: '' };

	const models = $derived(snapshot?.models ?? []);
	const choices = $derived(models.filter((item) => item.provider === provider));
	const current = $derived(choices.find((item) => item.model === model));
	const request = $derived(snapshot?.request ?? null);
	const sessionId = $derived(snapshot?.sessionId ?? (boundId || null));
	const locked = $derived(!client || busy !== '');
	const ready = $derived(Boolean(sessionId && current?.efforts.includes(effort)));
	const hint = $derived.by(() => {
		if (!sessionId) return 'Bind a session before queueing.';
		if (!ready) return 'This selection is not in the catalog.';
		return 'Queues a request only. The active and default selections are not changed.';
	});

	// A new provider picks its preferred catalog model; a new model picks its default effort.
	$effect.pre(() => {
		if (provider !== seen.provider || !current) {
			const opus = choices.find((item) => /opus[\s-]*5[.-]5/i.test(`${item.model} ${item.label}`));
			const next = (provider === 'harness-claude' && opus) || choices[0];
			const xhigh = provider === 'harness-claude' && next?.efforts.includes('xhigh');
			model = next?.model ?? '';
			effort = xhigh ? 'xhigh' : (next?.defaultEffort ?? '');
		} else if (model !== seen.model || !current.efforts.includes(effort)) {
			effort = current.defaultEffort;
		}
		seen = { provider, model };
	});

	function labelFor(target: ProviderSelection): string {
		const known = models.find(
			(item) => item.provider === target.provider && item.model === target.model
		);
		return known?.label ?? target.model;
	}
	function receive(data: PickerSnapshot) {
		if (!snapshot) provider = data.defaultProvider;
		snapshot = data;
	}
	async function run(
		note: string,
		name: string,
		args: Record<string, unknown>,
		done?: (data: unknown) => void
	) {
		if (!client || busy) return;
		busy = note;
		error = '';
		try {
			const data = await client.call(name, args);
			if (data && typeof data === 'object' && 'defaultProvider' in data)
				receive(data as PickerSnapshot);
			done?.(data);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Request failed.';
		} finally {
			busy = '';
		}
	}
	function bindSession(event: SubmitEvent) {
		event.preventDefault();
		const id = draftId.trim();
		if (id)
			void run('Binding session…', 'get_provider_status', { session_id: id }, () => (boundId = id));
	}
	function refresh() {
		void run('Refreshing…', 'get_provider_status', sessionId ? { session_id: sessionId } : {});
	}
	function queue() {
		const target = { session_id: sessionId, provider, model, effort };
		if (ready)
			void run('Queueing switch…', 'request_model_switch', target, () => (sessions = null));
	}
	function cancel() {
		const target = { session_id: request?.sessionId, request_id: request?.id };
		if (request) void run('Cancelling…', 'cancel_model_switch', target, () => (sessions = null));
	}
	function loadSessions() {
		void run('Loading queued sessions…', 'list_observed_sessions', {}, (data) => {
			const list = (data as { sessions?: unknown } | null)?.sessions;
			if (!Array.isArray(list)) throw new Error('Queued sessions could not be read.');
			sessions = list as SwitchRequest[];
		});
	}
	onMount(async () => {
		try {
			const opened = await providerPickerClient(receive);
			if (closed) await opened.close();
			else client = opened;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not connect to the model picker.';
		}
	});
	onDestroy(() => {
		closed = true;
		void client?.close();
	});
</script>
<hx-section
	class="provider-picker"
	data-harness-component="provider-picker"
	aria-busy={busy !== ''}
>
	<hx-header class="picker-head">
		<hx-h2>{label}</hx-h2>
		{#if snapshot}<hx-span class="picker-badge"
				><hx-span>{providers[snapshot.defaultProvider]}</hx-span> default</hx-span
			>{/if}
		<hx-button type="button" onclick={refresh} disabled={locked}>Refresh</hx-button>
	</hx-header>
	{#if client?.preview}
		<hx-p class="picker-note">
			Local preview: not connected to Codex. The session identity shown is synthetic.
		</hx-p>
	{/if}
	{#if error}<hx-p class="picker-note picker-error" role="alert">{error}</hx-p>{/if}
	{#if !snapshot}
		<hx-p class="picker-note" role="status">
			{error ? 'No picker state received.' : 'Waiting for picker state…'}
		</hx-p>
	{:else}
		{#if snapshot.message}
			<hx-p class="picker-note" class:picker-warn={!snapshot.controlConnected} role="status">
				{snapshot.message}
			</hx-p>
		{/if}
		{#if sessionId}
			<hx-p class="picker-session">Session <hx-code>{sessionId}</hx-code></hx-p>
		{:else}
			<hx-form class="picker-bind" onsubmit={bindSession}>
				<hx-label class="picker-field">
					<hx-span>Session ID</hx-span>
					<hx-input bind:value={draftId} autocomplete="off" spellcheck="false" disabled={locked} />
				</hx-label>
				<hx-button type="submit" disabled={locked || !draftId.trim()}>Bind session</hx-button>
			</hx-form>
		{/if}
		<ProviderPickerCards
			active={snapshot.active}
			{request}
			{models}
			{providers}
			{locked}
			oncancel={cancel}
		/>
		<hx-div class="picker-fields">
			<hx-span aria-hidden="true">Provider</hx-span>
			<Select bind:value={provider} label="Provider" disabled={locked}>
				{#each Object.entries(providers) as [id, name] (id)}
					<hx-option value={id} disabled={!models.some((item) => item.provider === id)}
						>{name}</hx-option
					>
				{/each}
			</Select>
			<hx-span aria-hidden="true">Model</hx-span>
			<Select bind:value={model} label="Model" disabled={locked || !choices.length}>
				{#each choices as item (item.model)}<hx-option value={item.model}>{item.label}</hx-option
					>{/each}
			</Select>
			<hx-span aria-hidden="true">Reasoning effort</hx-span>
			<Select bind:value={effort} label="Reasoning effort" disabled={locked || !current}>
				{#each current?.efforts ?? [] as level (level)}<hx-option value={level}>{level}</hx-option
					>{/each}
			</Select>
		</hx-div>
		<hx-div class="picker-actions">
			<hx-button type="button" class="picker-primary" onclick={queue} disabled={locked || !ready}
				>Queue switch</hx-button
			>
			<hx-p class="picker-hint" role="status">{busy || hint}</hx-p>
		</hx-div>
		<hx-div class="picker-queue">
			<hx-button type="button" onclick={loadSessions} disabled={locked}
				>{sessions ? 'Reload' : 'Show'} queued sessions</hx-button
			>
			{#each sessions ?? [] as item (item.id)}
				<hx-p>
					<hx-code>{item.sessionId}</hx-code>
					{labelFor(item.target)} · {item.target.effort} effort · {item.status}
				</hx-p>
			{:else}
				{#if sessions}<hx-p>No queued sessions.</hx-p>{/if}
			{/each}
			<hx-p class="picker-hint">
				Explicitly queued sessions only, loaded on request. Other native tasks are not listed.
			</hx-p>
		</hx-div>
	{/if}
	<hx-footer class="picker-foot">
		A queued switch takes effect only after the thread is closed on all clients and a verified
		resume succeeds. While desktop control is unavailable, the request stays pending.
	</hx-footer>
</hx-section>
