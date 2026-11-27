<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_uicofq6f3g -->
<script lang="ts">
	import type {
		ArtboardTheme,
		CanvasBoard
	} from '../../../utils/planning-collaboration/designCanvas.types';
	import { artboardDocument } from '../../../utils/planning-collaboration/artboardDocument';
	let { board, theme }: { board: CanvasBoard; theme: ArtboardTheme } = $props();
</script>

<!-- An empty sandbox: no script, form, popup, navigation of this page or access to it. -->
{#key theme}
	<hx-iframe
		title={board.title}
		sandbox=""
		referrerpolicy="no-referrer"
		tabindex="-1"
		inert
		width={board.width}
		height={board.height}
		srcdoc={artboardDocument(board.html, theme)}
	></hx-iframe>
{/key}

<style>
	iframe {
		display: block;
		border: 0;
		pointer-events: none;
	}
</style>
