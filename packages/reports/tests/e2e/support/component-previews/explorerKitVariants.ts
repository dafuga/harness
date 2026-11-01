import type { PreviewCases } from './shared';
import { text } from './shared';

const prefix = 'reports.component.explorer-ui-explorer-kit-';
export const explorerKitVariants: Record<string, string[]> = {
	[`${prefix}card`]: ['section', 'list-item', 'module', 'attributes'],
	[`${prefix}pill`]: ['state', 'tone'],
	[`${prefix}empty-state`]: ['action'],
	[`${prefix}notice`]: ['long'],
	[`${prefix}command-block`]: ['long', 'multiline']
};

/** Exercise public props through the same component fixtures used by normal catalog runs. */
export function explorerKitVariant(id: string, props: PreviewCases[string], variant: string) {
	if (!id.startsWith(prefix)) return null;
	if (id === `${prefix}card`) return card(props, variant);
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

function card(props: PreviewCases[string], variant: string) {
	if (variant === 'list-item')
		return {
			...props,
			as: 'li',
			children: text(
				'<h2>Invoice notifications</h2><p>Send an email after an invoice is approved.</p>'
			)
		};
	if (variant === 'module')
		return {
			...props,
			variant: 'module',
			tone: 'ex-function-tile',
			children: text('<h2>formatDuration</h2><p>Converts seconds to a readable duration.</p>')
		};
	if (variant === 'attributes')
		return {
			...props,
			id: 'invoice-card',
			label: 'Invoice notifications',
			component: 'explorer-ui-explorer-kit-card',
			children: text(
				'<h2>Invoice notifications</h2><p>Approved invoices appear in the activity feed.</p>'
			)
		};
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
