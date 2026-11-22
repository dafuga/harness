import { recordExampleCases } from '../support/recordExampleCases';

/**
 * Each state calls the unit's real code the way its callers do: the parser on committed Markdown,
 * the reader on a temporary project folder standing in for a revision's tree, and the hydration on
 * prebuilt unit views. What it was given and what it returned, summarised to its fields, is asserted
 * and recorded as the cases of its state.
 */
export const toolbarId = 'app.component.toolbar';

export const toolbarPath = 'src/components/toolbar/usage.md';

export const toolbarExamples = [
	{ name: 'Empty toolbar', input: { items: [] }, output: 'No actions' },
	{
		name: 'Disabled save',
		input: { items: [{ id: 'save', enabled: false }] },
		error: 'Action is disabled'
	}
];

/** Records the cases of one state; the file is named by the state id, as the scenario's evidence expects. */
export function record(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'function.unit-documentation',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}
