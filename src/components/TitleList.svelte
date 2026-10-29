<script lang="ts">
	import { titlesConfig } from '../config/titlesConfig';
	import TitleRow from './TitleRow.svelte';
	let { titles }: { titles: string[] } = $props();
</script>

<ul>
	{#each titles.slice(0, titlesConfig.limit) as title (title)}<TitleRow {title} />{/each}
</ul>
