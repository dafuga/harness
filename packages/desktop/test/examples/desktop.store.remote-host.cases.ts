import { recordExampleCases } from '../../../../test/support/recordExampleCases';

/** Writes this state's trace: its case is named after the state, and its file after the state. */
export function record(state: string, symbol: string, output: unknown) {
	recordExampleCases(
		{
			unitId: 'desktop.store.remote-host',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: state, input: null, output }]
	);
}
