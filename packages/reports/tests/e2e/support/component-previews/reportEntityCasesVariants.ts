import type { PreviewCases } from './shared';

const unit = 'js.function.json-parse';
const calls = {
	schemaVersion: 1,
	kind: 'function-invocations',
	unitId: unit,
	symbol: 'JSON.parse',
	cases: [
		{ name: 'Read saved settings', input: { text: '{"enabled":true}' }, output: { enabled: true } }
	]
};
const badCall = {
	name: 'Reject incomplete JSON',
	input: { text: '{"enabled":' },
	error: { name: 'SyntaxError', message: 'JSON Parse error: Unexpected EOF' }
};

/** Authored examples and recorded results retain their own success, failure and gap states. */
export function entityCasesVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'expanded') return props;
	if (variant === 'empty') return { ...props, examples: [] };
	if (variant === 'expected-error') return { ...props, examples: [badCall] };
	return recordedCaseVariant(props, variant);
}

function recordedCaseVariant(props: PreviewCases[string], variant: string) {
	const recorded = { ...props, examples: undefined, unit };
	if (variant === 'recorded') return { ...recorded, document: calls };
	if (variant === 'recorded-error')
		return { ...recorded, document: { ...calls, cases: [badCall] } };
	if (variant === 'observed' || variant === 'observed-noncallable')
		return {
			...recorded,
			callable: variant !== 'observed-noncallable',
			unit: variant === 'observed' ? 'app.function.filter-orders' : 'app.page.orders',
			document: { input: { searchText: 'SERVICE' }, output: ['Order 1042 · Service call'] }
		};
	if (variant === 'unavailable') return { ...recorded, document: { assertions: [] } };
	if (variant === 'malformed') return { ...recorded, document: { ...calls, cases: [] } };
	if (variant === 'wrong-unit') return { ...recorded, unit: 'app.function.other', document: calls };
	return null;
}
