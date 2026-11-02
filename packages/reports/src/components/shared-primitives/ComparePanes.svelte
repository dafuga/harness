<!-- @harness-tier organism -->
<!-- @harness-atoms ./atoms -->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import type { ComparisonPane } from '../../helpers/verification-evidence/comparisonPanes.types';
	import Pill from '../explorer-ui/explorer-kit/Pill.svelte';
	import EmptyState from '../explorer-ui/explorer-kit/EmptyState.svelte';
	let {
		panes,
		visible = 'both',
		className = 'ex-panes',
		paneClass = 'ex-pane',
		framed = true,
		headings = true,
		contents = false,
		children,
		heading,
		details,
		gap
	}: {
		/** Side contexts from comparisonPanes, retaining their own content and commit. */
		panes: ComparisonPane<T>[];
		/** Sides to display; defaults to both, preserving their labels in single-side views. */
		visible?: 'both' | 'before' | 'after';
		/** Owner's layout classes; defaults to ex-panes. */
		className?: string;
		/** Owner's side frame classes; defaults to ex-pane. */
		paneClass?: string;
		/** Draw each side's frame; false lets a specialized child own its frame. Defaults to true. */
		framed?: boolean;
		/** Show the shared heading and revision role inside each frame. Defaults to true. */
		headings?: boolean;
		/** Let an existing parent arrange the side boxes; defaults to false. */
		contents?: boolean;
		/** Optional side-specific gap slot; defaults to EmptyState with the recorded gap. */
		gap?: Snippet<[ComparisonPane<T>]>;
		/** Render the side's image, audio or detail content; errors propagate. */
		children: Snippet<[ComparisonPane<T>]>;
		/** Optional heading slot for the same side; defaults to shared label and role. */
		heading?: Snippet<[ComparisonPane<T>]>;
		/** Optional provenance or details slot for the same side; omitted by default. */
		details?: Snippet<[ComparisonPane<T>]>;
	} = $props();
	let shown = $derived(panes.filter((pane) => visible === 'both' || pane.side === visible));
</script>

<hx-div
	class={className}
	style:display={contents ? 'contents' : undefined}
	class:paired={shown.length > 1}
	data-harness-component="shared-primitives-compare-panes"
>
	{#each shown as pane (pane.key)}
		{#if framed}
			<hx-div class={paneClass} role="group" aria-label={pane.heading}>
				{#if headings}
					{#if heading}
						{@render heading(pane)}
					{:else}
						<hx-p class="ex-pane-head"
							><hx-strong>{pane.heading}</hx-strong><Pill>{pane.role}</Pill></hx-p
						>
					{/if}
				{/if}
				{#if pane.value === undefined && pane.gap}
					{#if gap}
						{@render gap(pane)}
					{:else}
						<EmptyState>{pane.gap}</EmptyState>
					{/if}
				{:else}
					{@render children(pane)}
				{/if}
				{@render details?.(pane)}
			</hx-div>
		{:else}
			{@render children(pane)}
		{/if}
	{/each}
</hx-div>
