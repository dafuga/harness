/**
 * What sets each design option apart. The first follows the proposal most directly; each other one
 * takes it somewhere the others do not, so that no two options are the same image asked twice.
 */
const directions = [
	'Follow the proposal most directly, as its plainest reading.',
	'Show more at once: a dense, information-first layout.',
	'Give room: fewer, larger elements and generous spacing.',
	'Lead with the primary action and the summary, then the detail.',
	'Split the screen: a list or navigation beside the detail.',
	'Present the main content as cards or tiles.',
	'Present the main content as a table or a list first.',
	'A bolder visual treatment with strong contrast and emphasis.',
	'A calm, minimal treatment with restrained colour.',
	'Arrange for the narrowest screen first, then let it widen.'
];

/** The directions of `count` design options, each different from every other. */
export function designDirections(count: number): string[] {
	return directions.slice(0, count);
}
