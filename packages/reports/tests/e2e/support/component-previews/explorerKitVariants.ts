import type { PreviewCases } from './shared';
import { text } from './shared';

const prefix = 'reports.component.explorer-ui-explorer-kit-';
export const explorerKitVariants: Record<string, string[]> = {
	[`${prefix}card`]: ['section', 'list-item', 'module', 'attributes'],
	[`${prefix}pill`]: ['state', 'tone', 'list-item', 'compact', 'chip', 'attributes'],
	[`${prefix}empty-state`]: ['action', 'block', 'status'],
	[`${prefix}notice`]: ['long', 'alert', 'block', 'list'],
	[`${prefix}command-block`]: ['long', 'multiline']
};

/** Exercise public props through the same component fixtures used by normal catalog runs. */
export function explorerKitVariant(id: string, props: PreviewCases[string], variant: string) {
	if (!id.startsWith(prefix)) return null;
	if (id === `${prefix}card`) return card(props, variant);
	if (id === `${prefix}pill`) return pill(props, variant);
	if (id === `${prefix}empty-state`) return emptyState(props, variant);
	if (id === `${prefix}notice`) return noticeState(props, variant);
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
				`<div>
					<h2>Invoice notifications</h2>
					<p>Send an email after an invoice is approved.</p>
				</div>`
			)
		};
	if (variant === 'module')
		return {
			...props,
			variant: 'module',
			tone: 'ex-function-tile',
			children: text(`<div>
				<h2>formatDuration</h2>
				<p>Converts seconds to a readable duration.</p>
			</div>`)
		};
	if (variant === 'attributes')
		return {
			...props,
			id: 'invoice-card',
			label: 'Invoice notifications',
			component: 'explorer-ui-explorer-kit-card',
			children: text(
				`<div>
					<h2>Invoice notifications</h2>
					<p>Approved invoices appear in the activity feed.</p>
				</div>`
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
	const variants: Record<string, object> = {
		'list-item': { as: 'li', children: text('<span>Read invoices</span>') },
		compact: { variant: 'compact', children: text('<span>Approved</span>') },
		chip: { variant: 'chip', children: text('<span>Current revision</span>') },
		attributes: {
			role: 'img',
			label: 'Invoice approved',
			title: 'Invoice A-1048',
			state: 'approved',
			children: text('<span>Approved invoice</span>')
		}
	};
	if (variants[variant]) return { ...props, ...variants[variant] };
	return variant === 'state'
		? { ...props, state: 'Available', children: text('<span>Available</span>') }
		: { ...props, tone: 'mod-state gold', state: 'Installed' };
}

function emptyState(props: PreviewCases[string], variant: string) {
	if (variant !== 'action')
		return {
			...props,
			as: variant === 'block' ? 'div' : 'p',
			role: variant === 'status' ? 'status' : undefined,
			className: 'ex-empty',
			children: text(
				variant === 'block'
					? '<span>No invoices have been approved in this project.</span>'
					: '<span>No approved invoices match this search.</span>'
			)
		};
	return {
		...props,
		children: text(
			'<span>No dependencies recorded. <a href="/harness/components">Browse components</a></span>'
		)
	};
}
function noticeState(props: PreviewCases[string], variant: string) {
	if (variant === 'list')
		return {
			...props,
			as: 'ul',
			role: 'list',
			className: 'ex-notice',
			children: text(
				'<li>No selected mobile capture is retained.</li><li>The parent screenshot is available in history.</li>'
			)
		};
	if (variant !== 'long')
		return {
			...props,
			as: variant === 'block' ? 'div' : 'p',
			role: variant === 'alert' ? 'alert' : 'note',
			children: text(
				variant === 'block'
					? '<span>Only the latest build has retained screenshots.</span>'
					: '<span>The selected revision has no retained mobile capture.</span>'
			)
		};
	return {
		...props,
		children: text(
			'<span>Some dependencies could not be read: packages/desktop/src/components/agents-providers/AgentControls.svelte and packages/desktop/src/components/networking-security/RemoteApproval.svelte. Check that both source files exist at the selected revision.</span>'
		)
	};
}
