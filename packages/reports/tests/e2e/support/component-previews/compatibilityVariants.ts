import type { ProviderState } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
import type { RemoteHost } from '../../../../../desktop/src/lib/stores/networking-security/remoteHost.svelte';
import type { PreviewCases } from './shared';

/** Canonical imports retain public bindings and the existing caller-owned operational state. */
export function compatibilityVariant(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'desktop.component.remote-approval') {
		if (variant === 'no-projects') return { ...props, projects: [] };
		if (variant === 'busy') {
			const store = props.store as RemoteHost;
			store.busy = true;
		}
		return props;
	}
	if (id !== 'desktop.component.agent-controls') return null;
	if (variant === 'compact') return { ...props, compact: true };
	if (variant === 'empty') return { ...props, providers: [] };
	const providers = props.providers as ProviderState[];
	return {
		...props,
		providers: providers.map((provider) => ({
			...provider,
			available: false,
			reason: 'Provider unavailable in this preview.'
		}))
	};
}
