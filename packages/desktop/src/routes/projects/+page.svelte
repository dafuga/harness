<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5ss75lisl2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ProjectOverview from '$shared/projects-sessions/project-overview/ProjectOverview.svelte';
	import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	import type {
		EnvironmentHost,
		RemoteMobileStatus
	} from '../../models/development-tooling/Environment.types';
	import { selectEnvironment } from '../../lib/verification-evidence/select-environment/selectEnvironment';
	import { ProjectSyncService } from '../../services/projects-sessions/ProjectSyncService';
	import '../../lib/styles/workspace.css';
	import '../../lib/styles/design.css';

	const unavailable: OverviewSnapshot = { status: 'unavailable' };
	/** Null only while the snapshot is read. Anywhere but the desktop app or the paired phone it is unavailable. */
	let snapshot = $state<OverviewSnapshot | null>(null);

	/**
	 * One zero-argument read. A phone first learns its computer and account state, so that the
	 * overview is offered only when they allow it. A refusal or a failure reads as unavailable.
	 */
	async function read(
		bridge: DesktopBridge | undefined,
		hosted: boolean
	): Promise<OverviewSnapshot> {
		try {
			if (hosted) await bridge?.hostedStatus?.();
			return (await bridge?.projectOverview?.()) ?? unavailable;
		} catch {
			return unavailable;
		}
	}

	onMount(() => {
		const environment = selectEnvironment(window as unknown as EnvironmentHost);
		const bridge =
			environment.kind === 'electron' || environment.kind === 'capacitor'
				? environment.bridge
				: undefined;
		const phone = environment.kind === 'capacitor' ? environment.phone : undefined;
		const releases: Array<(() => void) | undefined> = [];
		let asked = 0;
		/** The computer this read is for: null before any status, empty while not online. */
		let pairing: string | null = null;
		/** Every answer asked for before a change of pairing or account, or before a later read, is discarded. */
		const reload = async () => {
			const ticket = ++asked;
			const value = await read(bridge, !!phone);
			if (ticket === asked) snapshot = value;
		};
		/** A fresh pairing blanks the rows until its own read answers. */
		const show = () => {
			snapshot = null;
			void reload();
		};
		/** Rows gone at once; an answer in flight is discarded. The refresh of a paired phone goes on. */
		const cleared = () => {
			asked++;
			snapshot = unavailable;
		};
		/** Re-reads on focus, when shown, when back online and every half minute: on the desktop app and a paired phone. */
		const sync = new ProjectSyncService({ refresh: reload });
		const clear = () => {
			sync.stop();
			cleared();
		};
		/** The overview is read while the computer is online, and cleared the moment it is not. */
		const follow = (status: RemoteMobileStatus) => {
			const key = status.state === 'online' ? (status.host?.id ?? 'online') : '';
			if (key === pairing) return;
			pairing = key;
			if (!key) return clear();
			show();
			sync.start();
		};
		/** A sign-out or a denied account clears the rows of this computer too, not only those of a phone. */
		releases.push(
			bridge?.onCacheStatus?.((status) => {
				if (status.status === 'denied') cleared();
			})
		);
		if (!phone) {
			show();
			if (bridge) sync.start();
		} else {
			releases.push(phone.onStatus(follow));
			void phone.status().then(follow, clear);
		}
		return () => {
			asked++;
			sync.stop();
			releases.forEach((release) => release?.());
		};
	});
</script>

<svelte:head><title>Projects · Harness</title></svelte:head>

<ProjectOverview {snapshot} homeHref="/" />
