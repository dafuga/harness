<!-- @harness-tier molecule -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import { t } from '../../utils/reports-media/reportLocale';
	import type { Status } from '../../models/reports-media/Report.types';
	let { status }: { status: Status } = $props();
</script>

<hx-span class="badge {status}"><hx-span aria-hidden="true">●</hx-span> {$t(status)}</hx-span>
