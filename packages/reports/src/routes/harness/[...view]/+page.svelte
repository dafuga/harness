<!-- @harness-tier page -->
<!-- @harness-atoms ../../../components/shared-primitives/atoms -->
<script lang="ts">
	import ExplorerContent from '../../../components/explorer-ui/ExplorerContent.svelte';
	import HarnessScreen from '../../../components/explorer-ui/HarnessScreen.svelte';
</script>

<!-- An address no page of its own serves: the host corrects or refuses it, and what it may yet
     show is not known here, so this entry alone names the renderer of every screen. -->
<HarnessScreen title="Explorer" content={ExplorerContent} />
