<script lang="ts">
	import { onMount } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import {
		recordedPreview,
		type RecordedThumbnail,
		type PreviewState
	} from '../utils/recordedPreview';
	let {
		workspace,
		entityId,
		title,
		thumbnail,
		compact = false
	}: {
		workspace: Workspace;
		entityId: string;
		title: string;
		thumbnail: RecordedThumbnail;
		compact?: boolean;
	} = $props();
	let container: HTMLElement;
	let visible = $state(false);
	let view = $state<PreviewState>({ status: 'loading', url: '', caption: '', reason: '' });
	// Catalog navigation stays immediate; offscreen cards do not start history reads.
	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') {
			visible = true;
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				visible = true;
				observer.disconnect();
			},
			{ rootMargin: '200px' }
		);
		observer.observe(container);
		return () => observer.disconnect();
	});
	$effect(() => {
		if (!visible) return;
		return recordedPreview(workspace, entityId, thumbnail, (next) => (view = next));
	});
</script>

<figure
	bind:this={container}
	aria-label={`Recorded preview of ${title}`}
	title={view.caption || view.reason}
>
	{#if view.url}
		<img src={view.url} alt={`Screenshot of ${title}`} loading="lazy" decoding="async" />
		{#if !compact}<figcaption>{view.caption}</figcaption>{/if}
	{:else}
		<div class="placeholder muted" role="status">
			<span>{view.status === 'loading' ? 'Loading screenshot…' : 'Screenshot unavailable'}</span>
			{#if view.reason}<small>{view.reason}</small>{/if}
		</div>
	{/if}
</figure>

<style>
	figure {
		margin: 0;
		width: 100%;
		height: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	img {
		flex: 1;
		min-height: 0;
		height: 0;
		object-fit: contain;
	}
	figcaption {
		padding: 8px 10px;
		border-top: 1px solid var(--line);
		font-size: 12px;
		color: var(--muted);
	}
	.placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		justify-content: center;
		padding: 18px;
		text-align: center;
	}
	small {
		overflow-wrap: anywhere;
	}
</style>
