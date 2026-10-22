<script lang="ts">
	import BrandMark from '../../shared-primitives/BrandMark.svelte';
	import type { HarnessNavbarInput } from '../../../utils/explorer-ui/harnessShell';
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
	<div class="hx-header" data-harness-component="harness-harness-header">
		<HarnessNavbar {base} {...navbar} />
	</div>
{:else}
	<header class="hc-top" data-harness-component="harness-harness-header">
		<span class="brand-symbol" aria-hidden="true"><BrandMark /></span>
		<h1>Harness</h1>
		<span class="hc-muted">Components, impact and recorded evidence of this repository</span>
		<nav aria-label="Other views">
			{#each links as link, position (position)}<a href={link.href}>{link.label}</a>{/each}
		</nav>
	</header>
{/if}
{#if problem}<p class="hc-notice" role="alert">{problem}</p>{/if}
{#if missing}
	<p class="hc-notice" role="alert">
		{missing.message}
		{#if missing.home}<a class="hc-link" href={base + missing.home}>Open the newest commit</a>{/if}
	</p>
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
		margin-top: 20px;
	}
</style>
