<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ihssei4kbr -->
<script lang="ts">
	import type { HubBoardColumnSwitchProps } from './hubBoardColumnSwitch.types';

	let { columns, selected, onselect }: HubBoardColumnSwitchProps = $props();
</script>

<hx-div class="hs-switch" role="tablist" aria-label="Board column">
	<!-- Not built yet: {columns.length} columns, {selected}, {Boolean(onselect)} -->
</hx-div>
