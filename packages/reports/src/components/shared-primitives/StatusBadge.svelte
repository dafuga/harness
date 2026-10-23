<script lang="ts">
  import { t } from '../../utils/reports-media/reportLocale';
  import type { Status } from '../../models/reports-media/Report.types';
  let {status}: {status: Status} = $props();
</script>
<span class="badge {status}"><span aria-hidden="true">●</span> {$t(status)}</span>
