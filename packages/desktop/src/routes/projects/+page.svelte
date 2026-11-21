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
		/** Every answer asked for before a change of pairing or account is discarded. */
		const show = () => {
			const ticket = ++asked;
			snapshot = null;
			void read(bridge, !!phone).then((value) => {
				if (ticket === asked) snapshot = value;
			});
		};
		const clear = () => {
			asked++;
			snapshot = unavailable;
		};
		/** The overview is read while the computer is online, and cleared the moment it is not. */
		const follow = (status: RemoteMobileStatus) => {
			const key = status.state === 'online' ? (status.host?.id ?? 'online') : '';
			if (key === pairing) return;
			pairing = key;
			if (key) show();
			else clear();
		};
		if (!phone) show();
		else {
			releases.push(phone.onStatus(follow));
			releases.push(
				bridge?.onCacheStatus?.((status) => {
					if (status.status === 'denied') clear();
				})
			);
			void phone.status().then(follow, clear);
		}
		return () => {
			asked++;
			releases.forEach((release) => release?.());
		};
	});
</script>

<svelte:head><title>Projects · Harness</title></svelte:head>

<ProjectOverview {snapshot} homeHref="/" />
