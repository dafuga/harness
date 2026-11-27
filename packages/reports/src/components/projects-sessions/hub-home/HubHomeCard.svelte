<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_yynkdbd66b -->
<script lang="ts">
	import HarnessIcon from '$reports/components/explorer-ui/HarnessIcon.svelte';
	import type { Snippet } from 'svelte';
	import type { HomeSection } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { sections } from './hubHomePresentation';
	let {
		section,
		total,
		summary,
		open,
		children,
		footer,
		badge
	}: {
		section: HomeSection;
		total: number | undefined;
		summary: string;
		open: () => void;
		children: Snippet;
		footer?: Snippet;
		badge?: Snippet;
	} = $props();
	const entry = $derived(sections[section]);
</script>

<hx-section class={`po-card hh-section hh-${section}`} aria-labelledby={`hh-card-${section}`}>
	<hx-div class="po-card-head">
		<hx-div class="po-card-title">
			<hx-h2 id={`hh-card-${section}`} class="po-name">{entry.title}</hx-h2>
			<hx-p class="po-sessions">{summary}</hx-p>
		</hx-div>
		{@render badge?.()}
	</hx-div>
	<hx-div class="hh-section-body">{@render children()}</hx-div>
	<hx-div class="hh-section-foot">
		{@render footer?.()}
		<hx-button
			type="button"
			class="po-action hh-see-all"
			aria-label={`See all ${entry.noun}`}
			onclick={open}
		>
			{total
				? section === 'wip'
					? 'All work'
					: `All ${total} ${total === 1 ? entry.noun.replace(/s$/, '') : entry.noun}`
				: 'See all'}
			<HarnessIcon name="arrow-right" size={16} />
		</hx-button>
	</hx-div>
</hx-section>
