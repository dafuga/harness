<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import BrandMark from '../shared-primitives/BrandMark.svelte';
	import type { HarnessNavbarInput } from '../../utils/explorer-ui/harnessShell';
	import HarnessNavbar from './harness-navbar/HarnessNavbar.svelte';
	let {
		base,
		links = [],
		problem,
		missing,
		navbar = null
	}: {
		base: string;
		links?: Array<{ label: string; href: string }>;
		/** Why the history could not be loaded, when it could not. */
		problem: string;
		/** An address that names nothing in this history, and the way back from it. */
		missing: { message: string; home: string | null } | null;
		/** The bar of the explorer; with it the title row and its links to other views are not drawn. */
		navbar?: Omit<HarnessNavbarInput, 'base'> | null;
	} = $props();
</script>

{#if navbar}
	<!-- The bar as this header draws it. Its marker draws no box, and the bar and a notice under it
		lay out as they do without one. -->
	<hx-div class="hx-header" data-harness-component="harness-harness-header">
		<HarnessNavbar {base} {...navbar} />
	</hx-div>
{:else}
	<hx-header class="hc-top" data-harness-component="harness-harness-header">
		<hx-span class="brand-symbol" aria-hidden="true"><BrandMark /></hx-span>
		<hx-h1>Harness</hx-h1>
		<hx-span class="hc-muted">Components, impact and recorded evidence of this repository</hx-span>
		<hx-nav aria-label="Other views">
			{#each links as link, position (position)}<hx-a href={link.href}>{link.label}</hx-a>{/each}
		</hx-nav>
	</hx-header>
{/if}
{#if problem}<hx-p class="hc-notice" role="alert">{problem}</hx-p>{/if}
{#if missing}
	<hx-p class="hc-notice" role="alert">
		{missing.message}
		{#if missing.home}<hx-a class="hc-link" href={base + missing.home}>Open the newest commit</hx-a
			>{/if}
	</hx-p>
{/if}

<style>
	.hx-header {
		display: contents;
	}
	/* In the explorer's shell the marker takes nothing the bar did not have as the shell's child: it
	   passes on the shell's wrapping, and a notice after it keeps the space of one under the bar. */
	:global(.hx-shell) > .hx-header {
		overflow-wrap: inherit;
	}
	:global(.hx-shell) > .hx-header + .hc-notice {
		margin-top: var(--hx-space-20);
	}
</style>
