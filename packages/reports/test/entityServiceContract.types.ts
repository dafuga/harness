import type { HarnessUnit } from '../src/models/Harness.types';

/** A service as its manifest declares it, and its class as revision metadata records it. */
export type Declared = Pick<HarnessUnit, 'id' | 'title' | 'responsibility' | 'contract'> & {
	source: string;
	symbols: string[];
	className: string;
	/** The public methods the source declares, the constructor apart. */
	methods: string[];
};
