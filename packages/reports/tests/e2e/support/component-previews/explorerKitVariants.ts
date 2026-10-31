import type { PreviewCases } from './shared';
import { text } from './shared';

const prefix = 'reports.component.explorer-ui-explorer-kit-';
export const explorerKitVariants: Record<string, string[]> = {
	[`${prefix}card`]: ['section'],
	[`${prefix}pill`]: ['state', 'tone'],
	[`${prefix}empty-state`]: ['action'],
	[`${prefix}notice`]: ['long'],
	[`${prefix}command-block`]: ['long', 'multiline']
};

/** Exercise public props through the same component fixtures used by normal catalog runs. */
export function explorerKitVariant(id: string, props: PreviewCases[string], variant: string) {
	if (!id.startsWith(prefix)) return null;
	if (id === `${prefix}card`) return card(props);
	if (id === `${prefix}pill`) return pill(props, variant);
	if (id === `${prefix}empty-state`)
		return {
			...props,
			children: text(
				'<span>No dependencies recorded. <a href="/harness/components">Browse components</a></span>'
			)
		};
	if (id === `${prefix}notice`)
		return {
			...props,
			children: text(
				'<span>Some dependencies could not be read: packages/desktop/src/components/agents-providers/AgentControls.svelte and packages/desktop/src/components/networking-security/RemoteApproval.svelte. Check that both source files exist at the selected revision.</span>'
			)
		};
	return {
		...props,
		command:
			variant === 'multiline'
				? 'harness plugin add email\nharness plugin generate email email Welcome'
				: 'harness plugin add email && harness plugin generate email email CustomerAccountSubscriptionRenewalNotification'
	};
}

function card(props: PreviewCases[string]) {
	return {
		...props,
		as: 'section',
		tone: 'mod-card',
		labelledby: 'kit-card-title',
		children: text(
			'<div><h2 id="kit-card-title">Plugin setup</h2><p>Configure the selected plugin.</p></div>'
		)
	};
}

function pill(props: PreviewCases[string], variant: string) {
	return variant === 'state'
		? { ...props, state: 'Available', children: text('<span>Available</span>') }
		: { ...props, tone: 'mod-state gold', state: 'Installed' };
}
