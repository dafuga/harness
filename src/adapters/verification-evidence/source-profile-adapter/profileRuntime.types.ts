export interface Boundary {
	unit: string;
	operation: string;
	asynchronous: boolean;
	callable?: string;
	inferredName?: string;
}
