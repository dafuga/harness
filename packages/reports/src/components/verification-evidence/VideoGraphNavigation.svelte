<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_d526lwxlsr -->
<script lang="ts">
	import Select from '../shared-primitives/Select.svelte';
	import type { VideoGraphNavigationProps } from './VideoGraphNavigation.types';
	let { library, coverage = [], selected = $bindable('') }: VideoGraphNavigationProps = $props();
	$effect(() => {
		if (selected && !library.playlists.some((path) => path.id === selected)) selected = '';
	});
	const words = (id: string) =>
		id.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
	const percent = (value: number | undefined) =>
		typeof value === 'number' && Number.isFinite(value)
			? `${Math.round(value * 100)}%`
			: 'Not reported';
</script>

<hx-section
	class="video-graph-navigation"
	data-harness-component="video-graph-navigation"
	aria-label="Video paths and coverage"
>
	{#if library.playlists.length > 1}<hx-label
			>Video path<Select label="Video path" bind:value={selected}>
				<hx-option value="">All clips</hx-option>
				{#each library.playlists as path (path.id)}<hx-option value={path.id}
						>{words(path.id)}</hx-option
					>{/each}
			</Select></hx-label
		>{/if}
	<hx-h3>Declared graph coverage</hx-h3>
	{#if coverage.length}
		{#each coverage as graph (graph.graph)}<hx-div>
				<hx-p
					>{words(graph.graph)} · States {percent(graph.states)} · Transitions {percent(
						graph.edges
					)} · Clips {percent(graph.clips)}</hx-p
				>
				{#if !graph.complete}<hx-p role="status"
						>Missing required proof: {graph.missing.join(', ')}</hx-p
					>{/if}
			</hx-div>{/each}
	{:else}<hx-p role="status">No verified graph coverage is attached.</hx-p>{/if}
	{#if library.discoveryGaps?.length}<hx-div role="status">
			<hx-p>Page inventory pending</hx-p>
			{#each library.discoveryGaps as gap (`${gap.unit}-${gap.reason}`)}<hx-p>{gap.reason}</hx-p
				>{/each}
		</hx-div>{/if}
</hx-section>

<style>
	.video-graph-navigation {
		display: grid;
		gap: var(--hx-space-12);
		margin-block: var(--hx-space-16);
	}
</style>
