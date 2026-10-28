<script lang="ts">
	import { TitleService } from '../../services/TitleService';
	let { filled = false }: { filled?: boolean } = $props();
	const title = new TitleService().run(' 123 ');
</script>

<h1>{filled ? title : 'No titles'}</h1>
