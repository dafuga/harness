import type { ProviderState } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
import type { RemoteHost } from '../../../../../desktop/src/lib/stores/networking-security/remoteHost.svelte';
import type { PreviewCases } from './shared';
import { text } from './shared';

/** Canonical imports retain public bindings and the existing caller-owned operational state. */
export function compatibilityVariant(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'desktop.component.choice-dialog')
		return {
			...props,
			disabled: variant === 'disabled',
			...(variant === 'empty'
				? {
						children: text(
							'<p>No models available. Connect an agent provider to choose a model.</p>'
						)
					}
				: {})
		};
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
			reason: 'Codex is not connected. Sign in to choose a model.'
		}))
	};
}
