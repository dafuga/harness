<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HarnessNavbarInput } from '../../utils/explorer-ui/harnessShell';
	import HarnessHeader from './HarnessHeader.svelte';
	let {
		base,
		problem,
		missing,
		navbar,
		children
	}: {
		base: string;
		/** Why the history could not be loaded, when it could not. */
		problem: string;
		/** An address that names nothing in this history, and the way back from it. */
		missing: { message: string; home: string | null } | null;
		/** The bar of the explorer, as its host resolved it; this frame reads and chooses nothing. */
		navbar: Omit<HarnessNavbarInput, 'base'>;
		/** The page the frame holds, drawn in the column under the bar. */
		children: Snippet;
	} = $props();
</script>

<!-- The frame of every explorer page: the bar and its notices above the column a page fills. -->
<hx-div class="hx-shell" data-harness-component="explorer-ui-explorer-layout">
	<HarnessHeader {base} {problem} {missing} {navbar} />
	<hx-main class="hx-main">
		{@render children()}
	</hx-main>
</hx-div>
