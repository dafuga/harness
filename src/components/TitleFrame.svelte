<script lang="ts">
	import type { Snippet } from 'svelte';
	import TitleList from './TitleList.svelte';
	let { titles, children }: { titles: string[]; children?: Snippet } = $props();
</script>

<section style="display: flow-root; min-height: 100vh"><h2>Titles</h2>{#if children}{@render children()}{:else}<TitleList {titles} />{/if}</section>
