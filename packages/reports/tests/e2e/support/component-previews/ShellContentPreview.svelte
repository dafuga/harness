<script lang="ts">
	import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
	import ExplorerContent from '../../../../src/components/explorer-ui/ExplorerContent.svelte';
	import { shellArtworkHost } from './shellArtwork';
	let host: ExplorerScreenProps = $props();
</script>

<ExplorerContent {...shellArtworkHost(host)} />
