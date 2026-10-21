<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerLocation } from '../../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { plainClick } from '../../../utils/explorer-ui/harnessShell';
	let {
		to,
		nav,
		label,
		children,
		...rest
	}: {
		to: ExplorerLocation;
		nav: EntityNav;
		/** The accessible name, when the visible text alone does not say where the link leads. */
		label?: string;
		children: Snippet;
		class?: string;
		title?: string;
	} = $props();
	// A modified click, or any other button, stays the browser's: it may open another tab.
	function follow(event: MouseEvent) {
		if (!plainClick(event)) return;
		event.preventDefault();
		nav.go(to);
	}
</script>

<a href={nav.href(to)} aria-label={label} onclick={follow} {...rest}>{@render children()}</a>
