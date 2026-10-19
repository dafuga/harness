<script lang="ts">
	import BrandMark from '../BrandMark.svelte';
	import type { HarnessNavbarInput } from '../../utils/harnessShell';
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
	<HarnessNavbar {base} {...navbar} />
{:else}
	<header class="hc-top">
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
