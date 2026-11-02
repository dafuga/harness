import { statusModeProps } from './statusModeProps';
import type { PreviewCases } from './shared';
import { text } from './shared';

export const shellBasicProps: Record<
	string,
	(props: PreviewCases[string], variant: string) => PreviewCases[string]
> = {
	'reports.component.brand-mark': brandMarkProps,
	'reports.component.shared-primitives-loading-state': loadingStateProps,
	'reports.component.harness-harness-action': actionProps,
	'reports.component.harness-harness-icon': iconProps,
	'reports.component.harness-harness-verdict': verdictProps
};
function brandMarkProps(props: PreviewCases[string], variant: string) {
	if (variant === 'decorative') return { size: 56 };
	return { ...props, size: variant === 'inline' ? '1em' : '6rem' };
}
function loadingStateProps(props: PreviewCases[string], variant: string) {
	if (variant === 'inline') return { label: 'Loading earlier history…', inline: true };
	if (variant === 'default-label') return {};
	if (variant === 'long')
		return {
			label:
				'Loading the selected repository history, committed source files and recorded evidence…'
		};
	return props;
}
function actionProps(props: PreviewCases[string], variant: string) {
	const changes: Record<string, object> = {
		gold: { tone: 'gold' },
		button: { href: undefined },
		disabled: { disabled: true },
		plain: { tone: 'plain' },
		'trailing-icon': { lead: undefined, icon: 'arrow-right' },
		long: { children: text('<span>Review every recorded result for this selected revision</span>') }
	};
	return { ...props, ...changes[variant] };
}
function iconProps(props: PreviewCases[string], variant: string) {
	if (variant === 'decorative') return { ...props, label: undefined };
	if (variant === 'inline') return { ...props, size: undefined };
	return { ...props, name: variant.replace('icon-', '') };
}
function verdictProps(props: PreviewCases[string], variant: string) {
	if (variant === 'verdict') return { ...props, variant: 'verdict' };
	const mode = statusModeProps(variant);
	if (mode) return mode;
	const failed = variant.startsWith('failed') || variant === 'long-open';
	const unknown = variant.startsWith('unknown');
	let label = props.label;
	if (unknown) label = 'Evidence not recorded';
	if (failed) label = 'Required checks failed';
	let reasons: string[] = [];
	if (failed || unknown)
		reasons = [
			'The required mobile screenshot is missing.',
			'The result belongs to the selected commit.'
		];
	if (variant === 'long-open') {
		const names = [
			'Search results',
			'Component details',
			'Revision selector',
			'Verification tooltip'
		];
		const devices = ['desktop', 'tablet', 'mobile'];
		reasons = Array.from({ length: 24 }, (_, n) => {
			const state = `${names[n % names.length]} at ${devices[Math.floor(n / names.length) % devices.length]}`;
			return n < 12
				? `${state}: the required capture is missing for this revision. Run its declared component scenario before requesting full verification.`
				: `${state}: original image bytes are unavailable. Attach the capture with its recorded source revision and SHA-256 before verification.`;
		});
	}
	return { ...props, passed: !failed && !unknown, framed: variant === 'framed', label, reasons };
}
