<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_vyi5j6wq27 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getContext, onMount } from 'svelte';
	import { nativeAccountContext } from '../../../models/development-tooling/Environment.types';
	import type {
		NativeAccountContext,
		NativeSessionCursor,
		NativeSessionSummary,
		SessionNativePlugin
	} from '../../../models/development-tooling/Environment.types';

	const account = getContext<NativeAccountContext>(nativeAccountContext);
	const plugin = account.environment?.sessions;
	let sessions = $state<NativeSessionSummary[]>([]);
	let selected = $state<NativeSessionSummary>();
	let syncState = $state<Awaited<ReturnType<SessionNativePlugin['list']>>['state']>('connecting');
	let transcript = $state('');
	let live = $state('');
	let gap = $state(false);
	let segment = $state(0);
	let canRead = $state(false);
	let cursor: NativeSessionCursor = {};
	let decoder = new TextDecoder();
	let active = true;
	let selection = 0;
	let refreshing = false;
	let queued = false;
	const bytes = (value: string) =>
		Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

	onMount(() => {
		if (!plugin) return;
		const listener = plugin.addListener('changed', () => void refresh()).catch(() => undefined);
		void refresh();
		return () => {
			active = false;
			void listener.then((handle) => handle?.remove());
			void plugin.stop().catch(() => undefined);
		};
	});

	async function refresh() {
		if (!active || !plugin) return;
		if (refreshing) {
			queued = true;
			return;
		}
		refreshing = true;
		try {
			const next = await plugin.list();
			if (!active) return;
			({ state: syncState, sessions } = next);
			const current = selected;
			if (!current) return;
			if (!sessions.some((item) => item.scope === current.scope && item.runId === current.runId)) {
				select(undefined);
				return;
			}
			if (!transcript) await readSegment(current, 0);
			if (active && selected === current) await readLive(current);
		} catch {
			if (active) syncState = 'offline';
		} finally {
			refreshing = false;
			if (queued) {
				queued = false;
				void refresh();
			}
		}
	}

	function select(item: NativeSessionSummary | undefined) {
		selection += 1;
		selected = item;
		transcript = '';
		live = '';
		gap = false;
		canRead = false;
		segment = 0;
		cursor = {};
		decoder = new TextDecoder();
		if (item) void refresh();
	}

	async function readSegment(item: NativeSessionSummary, index: number) {
		const asked = selection;
		if (!plugin) return;
		const result = await plugin.transcript({ scope: item.scope, runId: item.runId, index });
		if (!active || asked !== selection) return;
		canRead = result.data !== null;
		if (result.data === null) return;
		segment = index;
		transcript = new TextDecoder().decode(bytes(result.data));
	}

	async function readLive(item: NativeSessionSummary) {
		const asked = selection;
		if (!plugin) return;
		const reply = await plugin.live({ scope: item.scope, runId: item.runId, ...cursor });
		if (!active || asked !== selection || !reply.stream) return;
		if (reply.stream !== cursor.stream) {
			cursor = { stream: reply.stream };
			decoder = new TextDecoder();
			live = '';
			gap = false;
		}
		appendFrames(reply.frames);
		if (reply.frames.length === 8) queued = true;
	}

	function appendFrames(frames: { counter: string; data: string }[]) {
		for (const frame of frames) {
			const previous = cursor.after === undefined ? -1n : BigInt(cursor.after);
			if (BigInt(frame.counter) <= previous) continue;
			if (BigInt(frame.counter) !== previous + 1n) {
				gap = true;
				decoder = new TextDecoder();
			}
			live = (live + decoder.decode(bytes(frame.data), { stream: true })).slice(-262_144);
			cursor.after = frame.counter;
		}
	}

	function showSegment(index: number) {
		if (selected)
			void readSegment(selected, index).catch(() => {
				syncState = 'offline';
			});
	}
</script>

<svelte:head><title>Sessions · Harness</title></svelte:head>

<hx-section data-harness-view="sessions" class="sessions-page">
	{#if selected}
		<hx-button type="button" onclick={() => select(undefined)}>All sessions</hx-button>
		<hx-h1>{selected.runId}</hx-h1>
		<hx-h2>Transcript</hx-h2>
		{#if transcript}
			<hx-pre>{transcript}</hx-pre>
			<hx-div class="segments">
				<hx-button type="button" disabled={segment === 0} onclick={() => showSegment(segment - 1)}
					>Previous</hx-button
				>
				<hx-button type="button" disabled={!canRead} onclick={() => showSegment(segment + 1)}
					>Next</hx-button
				>
			</hx-div>
		{:else}
			<hx-p>No transcript saved.</hx-p>
		{/if}
		{#if live}
			<hx-h2>Live output</hx-h2>
			{#if gap}<hx-p>Some earlier live output is unavailable.</hx-p>{/if}
			<hx-pre>{live}</hx-pre>
		{/if}
	{:else}
		<hx-a class="project-overview-link" href={resolve('/')}>Home</hx-a>
		<hx-h1>Sessions</hx-h1>
		{#if sessions.length}
			<hx-ul class="session-list">
				{#each sessions as item (item.scope + item.runId)}
					<hx-li>
						<hx-button
							type="button"
							class="recent-project session-row"
							aria-label={item.runId}
							onclick={() => select(item)}
						>
							<hx-strong>{item.runId}</hx-strong><hx-small>{item.status}</hx-small>
						</hx-button>
					</hx-li>
				{/each}
			</hx-ul>
		{:else if syncState === 'ready' || syncState === 'offline'}
			<hx-p>No sessions saved.</hx-p>
		{/if}
	{/if}
	<hx-p class="sync-status" role="status">
		{#if !plugin}Sessions are available in the Harness iPhone app.
		{:else if syncState === 'approval-required'}Approve this device to see account sessions.
		{:else if syncState === 'offline'}Offline · Showing saved sessions
		{:else if syncState === 'connecting'}Connecting to account sync
		{:else}Synced with account{/if}
	</hx-p>
</hx-section>

<style>
	.sessions-page {
		margin: 0 auto;
		max-width: 52rem;
		padding: var(--hx-space-20);
		overflow-wrap: anywhere;
	}
	.session-list {
		list-style: none;
		padding: 0;
	}
	.session-row {
		width: 100%;
	}
	.sync-status {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.segments {
		display: flex;
		gap: var(--hx-space-8);
	}
	.sessions-page :global(button) {
		min-height: 44px;
	}
</style>
