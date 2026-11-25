<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_itxfqio6qi -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { SealedHomeService } from './SealedHomeService';
	import type { SealedSession } from './sealedSessions.types';

	let { account }: { account: string } = $props();
	let sessions = $state<SealedSession[]>([]);
	let selected = $state<string>();
	const tails = new SvelteMap<string, string>();

	onMount(() => {
		const service = new SealedHomeService(account, {
			sessions: (rows) => {
				sessions = rows;
			},
			output: (stream, text) => {
				if (tails.size >= 64 && !tails.has(stream)) tails.delete(tails.keys().next().value!);
				tails.set(stream, text);
			}
		});
		void service.start().catch(() => {});
		return () => service.close();
	});
</script>

{#if sessions.length}
	<hx-section class="po-card hh-section session-card" aria-labelledby="sealed-home-sessions">
		<hx-div class="po-card-head">
			<hx-h2 class="po-name" id="sealed-home-sessions">Sessions</hx-h2>
		</hx-div>
		<hx-ul class="po-items hh-section-body">
			{#each sessions as session (session.id)}
				{@const tail = tails.get(JSON.stringify([session.scope, session.streamId]))}
				<hx-li>
					<hx-button
						type="button"
						class="po-action"
						aria-expanded={selected === session.id}
						onclick={() => {
							selected = selected === session.id ? undefined : session.id;
						}}>{session.title}</hx-button
					>
					<hx-span class="po-sessions">{session.status}</hx-span>
					{#if selected === session.id}
						{#if session.transcript}
							<hx-p class="po-sessions">Transcript</hx-p>
							<hx-pre aria-label="Transcript">{session.transcript}</hx-pre>
						{:else if !tail}
							<hx-p class="po-sessions">Waiting for session output.</hx-p>
						{/if}
						{#if tail}
							<hx-p class="po-sessions">Live output</hx-p>
							<hx-pre aria-label="Live output">{tail}</hx-pre>
						{/if}
					{/if}
				</hx-li>
			{/each}
		</hx-ul>
	</hx-section>
{/if}

<style>
	.session-card {
		margin-block-end: var(--hx-space-16);
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-block-size: 50vh;
		overflow: auto;
	}
</style>
