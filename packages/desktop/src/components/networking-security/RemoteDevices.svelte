<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_abu4bjyhp4 -->
<script lang="ts">
	import DeviceListRow from '$shared/accounts-access/DeviceListRow.svelte';
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import type { RemoteHost } from '../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemoteDeviceInfo } from '../../models/development-tooling/Environment.types';
	import { grantLabel } from '../../utils/networking-security/remoteLabels';
	import { timeLabel } from '../../utils/shared-primitives/timeLabel';
	let {
		devices,
		projects,
		store
	}: {
		devices: RemoteDeviceInfo[];
		projects: { id: string; name: string }[];
		store: RemoteHost;
	} = $props();
	/** Connected devices with exactly what each may reach. Revoking ends its sessions at once. */
	const names = $derived(new Map(projects.map((item) => [item.id, item.name])));
	const seen = (item: RemoteDeviceInfo) =>
		item.lastSeenAt ? `Last seen ${timeLabel(item.lastSeenAt)}` : 'Not connected';
</script>

{#if devices.length}<hx-ul class="remote-devices" aria-label="Connected devices">
		{#each devices as item (item.deviceId)}
			<DeviceListRow name={item.name} status={item.online ? 'Connected' : seen(item)}>
				{#each item.projectIds as id (id)}<Pill as="span" variant="chip" tone="remote-devices-chip"
						>{names.get(id) ?? 'Project no longer listed'}</Pill
					>{/each}<hx-span>{grantLabel(item)}</hx-span><hx-button
					type="button"
					aria-label={`Revoke ${item.name}`}
					disabled={store.busy}
					onclick={() => void store.revoke(item.deviceId)}>Revoke</hx-button
				>
			</DeviceListRow>
		{/each}
	</hx-ul>{:else}<hx-span class="muted">No devices have connected.</hx-span>{/if}
