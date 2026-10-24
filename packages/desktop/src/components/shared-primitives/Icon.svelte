<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { harnessIcons } from '../../../../reports/src/utils/harnessIcons';
	let { name, size = 22 }: { name: string; size?: number } = $props();
	const paths: Record<string, string> = {
		open: 'M5 12h14 M12 5l7 7-7 7',
		pages: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
		// An endpoint is drawn as the route glyph the explorer gives its APIs.
		apis: harnessIcons.route,
		layouts: 'M3 4h18v16H3z M3 9h18 M8 9v11',
		components: 'm12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
		models: 'M4 5h16v14H4zM4 10h16M10 10v9',
		functions: 'M16 3h-3c-3 0-3 4-4 9s-1 9-4 9 M5 9h11',
		configs:
			'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
		services: 'm12 2 10 6-10 6L2 8z M3 12l9 6 9-6 M3 17l9 5 9-5',
		model:
			'M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
		reasoning: 'M3 17a9 9 0 0 1 18 0 M12 17l4-5 M6 11l1.5 1 M12 8v2 M18 11l-1.5 1',
		settings: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
		branch:
			'M6 3v12 M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 9a9 9 0 0 1-9 9',
		commit: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M3 12h6 M15 12h6',
		workbench: 'M2 10h20 M4 10v10 M20 10v10 M4 16h16 M7 10V6h4v4 M15 10V7.5h3V10',
		deploy: 'M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2 M12 13v8 M8 17l4-4 4 4'
	};
</script>

<hx-svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><hx-svg-path d={paths[name] || paths.pages} /></hx-svg
>
