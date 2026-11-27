<!-- @harness-tier molecule -->
<!-- @harness-atoms ./atoms -->
<!-- @harness-uid u_wn2wx7doya -->
<script lang="ts">
	import { linkSegments } from '../../utils/strings/linkSegments';
	let { text }: { text: string } = $props();
	const segments = $derived(linkSegments(text));
</script>

{#each segments as part}
	{#if part.href}<hx-a
			class="hx-text-link"
			href={part.href}
			target="_blank"
			rel="noopener noreferrer">{part.text}</hx-a
		>{:else}{part.text}{/if}
{/each}

<style>
	.hx-text-link {
		overflow-wrap: anywhere;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}
</style>
