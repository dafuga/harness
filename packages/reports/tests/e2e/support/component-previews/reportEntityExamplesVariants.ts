import type { PreviewCases } from './shared';

const setup =
	'const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });';
const example = {
	name: 'Format an order total',
	call: 'formatter.format(128)',
	input: { value: 128 },
	output: '$128.00'
};
const documented = { path: 'README.md', examples: [example] };

/** Setup, missing documentation and expected failures are separate examples states. */
export function entityExamplesVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, documentation: { path: 'README.md', examples: [] } };
	if (variant === 'gap')
		return {
			...props,
			documentation: {
				path: 'README.md',
				examples: [],
				gap: 'The documented examples are malformed.'
			}
		};
	if (variant === 'setup')
		return {
			...props,
			documentation: { ...documented, setup },
			setupTitle: 'Create the formatter'
		};
	if (variant === 'inline-setup') return { ...props, documentation: { ...documented, setup } };
	if (variant === 'missing-setup')
		return { ...props, documentation: documented, setupTitle: 'Create the formatter' };
	if (variant === 'error')
		return {
			...props,
			documentation: {
				path: 'README.md',
				examples: [
					{
						name: 'Reject incomplete JSON',
						call: `JSON.parse('{"enabled":')`,
						input: { text: '{"enabled":' },
						error: 'SyntaxError: JSON Parse error: Unexpected EOF'
					}
				]
			}
		};
	if (variant === 'missing-call')
		return {
			...props,
			documentation: {
				path: 'README.md',
				examples: [{ name: 'Format a duration', input: { seconds: 90 }, output: '1:30' }]
			}
		};
	if (variant === 'void')
		return {
			...props,
			documentation: {
				path: 'README.md',
				setup: 'const counts = new Map([["orders", 3]]);',
				examples: [{ name: 'Clear saved counts', call: 'counts.clear()', input: {} }]
			}
		};
	return null;
}
