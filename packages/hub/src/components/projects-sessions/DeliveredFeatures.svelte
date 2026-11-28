<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_vuxtdbv3tu -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import VideoEvidence from '$shared/verification-evidence/VideoEvidence.svelte';
	import {
		featureDeliveryApi,
		featureDeliveryPageSchema,
		featureDeliverySource
	} from '../../../../../src/core/projects-sessions/featureDelivery';
	import type {
		FeatureDelivery,
		FeatureDeliveryStage
	} from '../../../../../src/core/projects-sessions/featureDelivery.types';
	let { project }: { project: string } = $props();
	let entries = $state<FeatureDelivery[]>([]);
	let cursor = $state<string | null>(null);
	let error = $state(false);
	let loading = $state(true);
	const controller = new AbortController();
	const labels: Record<FeatureDeliveryStage, string> = {
		dev: 'Dev',
		staging: 'Staging',
		live: 'Live'
	};
	const date = new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Europe/Lisbon'
	});

	async function load(next?: string) {
		loading = true;
		error = false;
		try {
			const query = new SvelteURLSearchParams({ project });
			if (next) query.set('cursor', next);
			const response = await fetch(featureDeliveryApi + '?' + query, { signal: controller.signal });
			if (!response.ok) throw new Error('Delivery list unavailable');
			const page = featureDeliveryPageSchema.parse(await response.json());
			entries = next ? [...entries, ...page.deliveries] : page.deliveries;
			cursor = page.cursor;
		} catch {
			error = !controller.signal.aborted;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
		return () => controller.abort();
	});
</script>

<hx-section
	class="deliveries"
	aria-labelledby="deliveries-title"
	data-harness-component="delivered-features"
>
	<hx-h2 id="deliveries-title">Delivered features</hx-h2>
	{#if entries.length}
		<hx-div class="delivery-grid">
			{#each entries as entry (`${entry.id}:${entry.stage}:${entry.at}`)}
				<VideoEvidence
					item={{
						id: entry.id,
						title: entry.title,
						file: featureDeliverySource(entry),
						category: 'delivery',
						status: 'passed'
					}}
					assetBase=""
					playbackOnly
				>
					{#snippet metadata()}
						<hx-div class="delivery-meta">
							<hx-time datetime={entry.at}>{date.format(new Date(entry.at))}</hx-time>
							<hx-span>{labels[entry.stage]}</hx-span>
						</hx-div>
					{/snippet}
				</VideoEvidence>
			{/each}
		</hx-div>
	{/if}
	{#if loading}
		<hx-p class="delivery-meta" role="status">Loading delivery videos…</hx-p>
	{:else if error}
		<hx-p class="delivery-meta" role="status">Delivery videos are unavailable.</hx-p>
	{:else if !entries.length && !cursor}
		<hx-p class="delivery-meta">No delivery videos yet.</hx-p>
	{/if}
	{#if cursor || error}
		<hx-button
			type="button"
			class="more"
			disabled={loading}
			onclick={() => load(cursor ?? undefined)}
		>
			{error ? 'Try again' : 'Show more'}
		</hx-button>
	{/if}
</hx-section>

<style>
	.deliveries {
		display: grid;
		gap: var(--hx-space-16);
		margin-block: var(--hx-space-24);
	}
	h2,
	p {
		margin: 0;
	}
	.delivery-grid {
		display: grid;
		gap: var(--hx-space-16);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		max-width: 68rem;
		align-items: start;
	}
	.delivery-meta {
		display: flex;
		justify-content: space-between;
		width: 100%;
		gap: var(--hx-space-12);
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-sm);
	}
	.deliveries :global(.video-evidence h3) {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.more {
		justify-self: start;
		min-height: 44px;
	}
</style>
