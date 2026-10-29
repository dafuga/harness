<script lang="ts">
 import TitleFrame from '../../src/components/TitleFrame.svelte';
 let { titles, children }: { titles: string[]; children?: string } = $props();
</script>
{#if children}<TitleFrame {titles}><span>{children}</span></TitleFrame>{:else}<TitleFrame {titles} />{/if}
