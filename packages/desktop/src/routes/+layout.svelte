<!-- @harness-tier layout -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_f5w3bdi732 -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, setContext, type Snippet } from 'svelte';
	import AccountSignIn from '../components/accounts-access/AccountSignIn.svelte';
	import type { NativeHostedStatus } from '../models/projects-sessions/ProjectContext.types';
	import { nativeAccountContext } from '../models/development-tooling/Environment.types';
	import type {
		Environment,
		EnvironmentHost,
		NativeAccountContext
	} from '../models/development-tooling/Environment.types';
	import { selectEnvironment } from '../lib/verification-evidence/select-environment/selectEnvironment';
	import '../lib/styles/workspace.css';
	import '../lib/styles/design.css';

	let { children }: { children: Snippet } = $props();
	let environment = $state.raw<Environment>();
	let required = $state(false);
	let status = $state.raw<NativeHostedStatus>();
	let busy = $state(false);
	let error = $state('');
	let signingIn = false;
	let active = true;
	let turn = 0;
	let timer: ReturnType<typeof setTimeout>;
	const signedIn = $derived(status?.state === 'signed-in' && Boolean(status.actor?.id));

	function schedule() {
		clearTimeout(timer);
		if (!active || !required) return;
		const delay = status?.state === 'pending' ? (status.handoff?.interval ?? 2) * 1000 : 30_000;
		timer = setTimeout(() => void refresh(), delay);
	}

	async function accept(answer: NativeHostedStatus, asked: number) {
		if (signingIn && answer.state === 'signed-in') {
			await goto(resolve('/'), { replaceState: true });
			if (!active || asked !== turn) return;
		}
		error =
			signingIn && status?.state === 'pending' && answer.state === 'signed-out'
				? 'Sign-in ended. Try again.'
				: '';
		status = answer;
		if (answer.state !== 'pending') signingIn = false;
	}

	async function update(call: () => Promise<NativeHostedStatus>, action = false) {
		if (!active || (!action && busy)) return;
		const asked = ++turn;
		if (action) busy = true;
		try {
			const answer = await call();
			if (!active || asked !== turn) return;
			await accept(answer, asked);
		} catch {
			if (active && asked === turn) error = 'Could not confirm sign-in. Try again.';
		} finally {
			if (active && asked === turn) {
				busy = false;
				schedule();
			}
		}
	}

	function refresh() {
		const check = environment?.bridge?.hostedStatus;
		if (check) return update(check);
		if (required) status = { configured: false, state: 'signed-out' };
	}

	function connect(google: boolean) {
		const connect = environment?.bridge?.connectHosted;
		if (!connect || busy) return;
		signingIn = true;
		error = '';
		return update(() => connect({ google }), true);
	}

	function signOut() {
		const leave = environment?.bridge?.disconnectHosted;
		if (!leave) return;
		signingIn = false;
		status = { configured: status?.configured ?? true, state: 'signed-out' };
		error = '';
		return update(leave, true);
	}

	setContext<NativeAccountContext>(nativeAccountContext, {
		get environment() {
			return environment;
		},
		get signedIn() {
			return signedIn;
		},
		get accountName() {
			return status?.actor?.name;
		},
		signOut
	});

	onMount(() => {
		const selected = selectEnvironment(window as unknown as EnvironmentHost);
		environment = selected;
		document.documentElement.dataset.environment = selected.kind;
		required =
			selected.kind === 'capacitor' ||
			(selected.kind === 'electron' &&
				(location.protocol === 'harness:' || Boolean(selected.bridge?.hostedStatus)));
		if (!required) return;
		void refresh();
		const wake = () => void refresh();
		const off = selected.bridge?.onCacheStatus?.(({ status }) => {
			if (status === 'denied') wake();
		});
		window.addEventListener('focus', wake);
		window.addEventListener('online', wake);
		return () => {
			active = false;
			clearTimeout(timer);
			off?.();
			window.removeEventListener('focus', wake);
			window.removeEventListener('online', wake);
		};
	});
</script>

{#if environment && (!required || signedIn)}
	{#key status?.actor?.id}
		{@render children()}
	{/key}
{:else if environment}
	<AccountSignIn {status} {error} {busy} {connect} cancel={signOut} retry={refresh} />
{:else}
	<hx-main aria-busy="true" aria-label="Loading Harness"></hx-main>
{/if}
