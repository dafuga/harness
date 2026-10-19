import type { Category } from '../models/Desktop.types';

/** Where a reference leads and what it is called, both read from the shown catalog. */
export interface UnitLink {
	to: string;
	name: string;
	category: Category;
}

export { unitLinks } from '../components/reference-text/unitLinks';
