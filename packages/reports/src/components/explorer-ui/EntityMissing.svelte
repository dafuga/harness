<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
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

<hx-section
	class="ex-card ex-missing"
	aria-labelledby="ex-missing-title"
	data-harness-component="harness-entity-missing"
>
	<hx-h1 id="ex-missing-title">{title}</hx-h1>
	<hx-p><HarnessVerdict passed={false} label="Not shown" /></hx-p>
	<hx-p class="ex-lead">{message}</hx-p>
	<hx-p class="ex-soft">Nothing from another revision is shown in its place.</hx-p>
	<HarnessAction href={nav.href(to)} onclick={() => nav.go(to)} lead="arrow-left"
		>{action}</HarnessAction
	>
</hx-section>
