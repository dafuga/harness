<script lang="ts">
	import { slugify } from '../utils/slugify';
	let { title }: { title: string } = $props();
</script>

<li data-slug={slugify(title)}>{title}</li>
