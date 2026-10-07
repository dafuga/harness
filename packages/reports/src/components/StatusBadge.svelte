<script lang="ts">
  import { t } from '../utils/reportLocale';
  import type { Status } from '../models/Report.types';
  let {status}: {status: Status} = $props();
</script>
<span class="badge {status}"><span aria-hidden="true">●</span> {$t(status)}</span>
