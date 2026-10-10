import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { consoleCanonical } from '../../../../../../src/utils/consoleCanonical';
import { consoleData } from '../../../utils/consoleServer';

/**
 * The root of the console and the earlier query addresses lead to the page they stand for.
 * A page path is served as it is; what it shows is decided from the index in the browser.
 */
export async function load({ url }: ServerLoadEvent) {
	if (url.pathname !== '/harness' && url.search === '') return {};
	const index = await consoleData.json('index.json');
	const target = index ? consoleCanonical(JSON.parse(index), url, '/harness') : undefined;
	if (target) redirect(308, target);
	return {};
}
