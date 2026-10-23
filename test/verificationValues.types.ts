export type ObservationValue =
	| null
	| boolean
	| number
	| string
	| ObservationValue[]
	| { [key: string]: ObservationValue };

export interface State {
	depth: number;
	seen: WeakSet<object>;
	budget: { remaining: number };
}
