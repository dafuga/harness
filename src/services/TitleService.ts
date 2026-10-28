import { slugify } from '../utils/slugify';

export const titleCost = 10.0;

export class TitleService {
	run(title: string): string {
		return slugify(title);
	}
}
