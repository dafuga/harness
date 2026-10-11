<script lang="ts">
	let { name, size = 22 }: { name: string; size?: number } = $props();
	const paths: Record<string, string> = {
		pages: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
		components: 'm12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
		functions: 'M16 3h-3c-3 0-3 4-4 9s-1 9-4 9 M5 9h11',
		configs:
			'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
		services: 'm12 2 10 6-10 6L2 8z M3 12l9 6 9-6 M3 17l9 5 9-5'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={paths[name] || paths.pages} /></svg
>
