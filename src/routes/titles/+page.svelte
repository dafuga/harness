<script lang="ts">
	import TitleList from '../../components/TitleList.svelte';
	import { TitleService } from '../../services/TitleService';
	let { filled = false }: { filled?: boolean } = $props();
	const label = 'Hello';
	const title = new TitleService().run(' 123 ');
</script>

<h1 data-history-label={label}>{filled ? title : 'No titles'}</h1>
{#if filled}<TitleList titles={[title]} />{/if}
