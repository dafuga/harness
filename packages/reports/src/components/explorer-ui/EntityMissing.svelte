<script lang="ts">
	import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		title,
		message,
		nav,
		to,
		action = 'Back to the collection'
	}: {
		title: string;
		/** Why nothing is shown; nothing of another revision is shown in its place. */
		message: string;
		nav: EntityNav;
		to: ExplorerLocation;
		action?: string;
	} = $props();
</script>

<section
	class="ex-card ex-missing"
	aria-labelledby="ex-missing-title"
	data-harness-component="harness-entity-missing"
>
	<h1 id="ex-missing-title">{title}</h1>
	<p><HarnessVerdict passed={false} label="Not shown" /></p>
	<p class="ex-lead">{message}</p>
	<p class="ex-soft">Nothing from another revision is shown in its place.</p>
	<HarnessAction href={nav.href(to)} onclick={() => nav.go(to)} lead="arrow-left"
		>{action}</HarnessAction
	>
</section>
