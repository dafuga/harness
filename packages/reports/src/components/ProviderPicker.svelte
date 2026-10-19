<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Select from './Select.svelte';
	import ProviderPickerCards from './ProviderPickerCards.svelte';
	import { providerPickerClient, type PickerClient } from '../utils/providerPickerClient';
	import type { PickerSnapshot, SwitchRequest } from '../../../../src/core/pickerTypes';
	import type { ProviderSelection } from '../../../../src/core/pickerModelTypes';
	import '../lib/styles/provider-picker.css';

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

<section class="provider-picker" data-harness-component="provider-picker" aria-busy={busy !== ''}>
	<header class="picker-head">
		<h2>{label}</h2>
		{#if snapshot}<span class="picker-badge"
				><span>{providers[snapshot.defaultProvider]}</span> default</span
			>{/if}
		<button type="button" onclick={refresh} disabled={locked}>Refresh</button>
	</header>
	{#if client?.preview}
		<p class="picker-note">
			Local preview: not connected to Codex. The session identity shown is synthetic.
		</p>
	{/if}
	{#if error}<p class="picker-note picker-error" role="alert">{error}</p>{/if}
	{#if !snapshot}
		<p class="picker-note" role="status">
			{error ? 'No picker state received.' : 'Waiting for picker state…'}
		</p>
	{:else}
		{#if snapshot.message}
			<p class="picker-note" class:picker-warn={!snapshot.controlConnected} role="status">
				{snapshot.message}
			</p>
		{/if}
		{#if sessionId}
			<p class="picker-session">Session <code>{sessionId}</code></p>
		{:else}
			<form class="picker-bind" onsubmit={bindSession}>
				<label class="picker-field">
					<span>Session ID</span>
					<input bind:value={draftId} autocomplete="off" spellcheck="false" disabled={locked} />
				</label>
				<button type="submit" disabled={locked || !draftId.trim()}>Bind session</button>
			</form>
		{/if}
		<ProviderPickerCards
			active={snapshot.active}
			{request}
			{models}
			{providers}
			{locked}
			oncancel={cancel}
		/>
		<div class="picker-fields">
			<span aria-hidden="true">Provider</span>
			<Select bind:value={provider} label="Provider" disabled={locked}>
				{#each Object.entries(providers) as [id, name] (id)}
					<option value={id} disabled={!models.some((item) => item.provider === id)}>{name}</option>
				{/each}
			</Select>
			<span aria-hidden="true">Model</span>
			<Select bind:value={model} label="Model" disabled={locked || !choices.length}>
				{#each choices as item (item.model)}<option value={item.model}>{item.label}</option>{/each}
			</Select>
			<span aria-hidden="true">Reasoning effort</span>
			<Select bind:value={effort} label="Reasoning effort" disabled={locked || !current}>
				{#each current?.efforts ?? [] as level (level)}<option value={level}>{level}</option>{/each}
			</Select>
		</div>
		<div class="picker-actions">
			<button type="button" class="picker-primary" onclick={queue} disabled={locked || !ready}
				>Queue switch</button
			>
			<p class="picker-hint" role="status">{busy || hint}</p>
		</div>
		<div class="picker-queue">
			<button type="button" onclick={loadSessions} disabled={locked}
				>{sessions ? 'Reload' : 'Show'} queued sessions</button
			>
			{#each sessions ?? [] as item (item.id)}
				<p>
					<code>{item.sessionId}</code>
					{labelFor(item.target)} · {item.target.effort} effort · {item.status}
				</p>
			{:else}
				{#if sessions}<p>No queued sessions.</p>{/if}
			{/each}
			<p class="picker-hint">
				Explicitly queued sessions only, loaded on request. Other native tasks are not listed.
			</p>
		</div>
	{/if}
	<footer class="picker-foot">
		A queued switch takes effect only after the thread is closed on all clients and a verified
		resume succeeds. While desktop control is unavailable, the request stays pending.
	</footer>
</section>
