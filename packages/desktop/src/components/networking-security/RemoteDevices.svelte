<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { RemoteHost } from '../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemoteDeviceInfo } from '../../models/development-tooling/Environment.types';
	import { grantLabel } from '../../utils/networking-security/remoteLabels';
	import { timeLabel } from '../../utils/development-tooling/timeLabel';
	let {
		devices,
		projects,
		store
	}: {
		devices: RemoteDeviceInfo[];
		projects: { id: string; name: string }[];
		store: RemoteHost;
	} = $props();
	/** Approved phones with exactly what each may reach. Revoking ends its sessions at once. */
	const names = $derived(new Map(projects.map((item) => [item.id, item.name])));
	const seen = (item: RemoteDeviceInfo) =>
		item.lastSeenAt ? `Last seen ${timeLabel(item.lastSeenAt)}` : 'Not connected';
</script>

{#if devices.length}<hx-ul class="remote-devices" aria-label="Approved phones">
		{#each devices as item (item.deviceId)}<hx-li>
				<hx-strong>{item.name}</hx-strong>{#each item.projectIds as id (id)}<hx-span class="chip"
						>{names.get(id) ?? 'Project no longer listed'}</hx-span
					>{/each}<hx-span>{grantLabel(item)}</hx-span><hx-span class="muted"
					>{item.online ? 'Connected' : seen(item)}</hx-span
				><hx-button
					type="button"
					aria-label={`Revoke ${item.name}`}
					disabled={store.busy}
					onclick={() => void store.revoke(item.deviceId)}>Revoke</hx-button
				>
			</hx-li>{/each}
	</hx-ul>{:else}<hx-span class="muted">No phone is approved.</hx-span>{/if}
