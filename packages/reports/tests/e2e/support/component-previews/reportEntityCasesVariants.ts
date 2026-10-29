import type { PreviewCases } from './shared';

const unit = 'app.function.format-duration';
const calls = {
	schemaVersion: 1,
	kind: 'function-invocations',
	unitId: unit,
	symbol: 'formatDuration',
	cases: [{ name: 'Format 90 seconds', input: { seconds: 90 }, output: '1:30' }]
};
const badCall = {
	name: 'Reject a negative duration',
	input: { seconds: -1 },
	error: { name: 'RangeError', message: 'Seconds must be non-negative.' }
};

/** Authored examples and recorded results retain their own success, failure and gap states. */
export function entityCasesVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'expanded') return props;
	if (variant === 'empty') return { ...props, examples: [] };
	if (variant === 'expected-error') return { ...props, examples: [badCall] };
	const recorded = { ...props, examples: undefined, unit };
	if (variant === 'recorded') return { ...recorded, document: calls };
	if (variant === 'recorded-error')
		return { ...recorded, document: { ...calls, cases: [badCall] } };
	if (variant === 'observed' || variant === 'observed-noncallable')
		return {
			...recorded,
			callable: variant !== 'observed-noncallable',
			document: { input: { searchText: 'SERVICE' }, output: ['Order 1042 · Service call'] }
		};
	if (variant === 'unavailable') return { ...recorded, document: { assertions: [] } };
	if (variant === 'malformed') return { ...recorded, document: { ...calls, cases: [] } };
	if (variant === 'wrong-unit') return { ...recorded, unit: 'app.function.other', document: calls };
	return null;
}
