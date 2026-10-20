import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import {
	consoleCanonical,
	explorerExact
} from '../../../../../../src/utils/console-canonical/consoleCanonical';
import { consoleData } from '../../../utils/console-server/consoleServer';

/**
 * The root of the console, a branch or a commit alone, and every earlier address lead to the
 * explorer address they stand for. An exact explorer address is served as it is, without
 * reading the history; what it shows is decided from the index in the browser.
 */
export async function load({ url }: ServerLoadEvent) {
	if (explorerExact(url.pathname.slice('/harness'.length), url.search)) return {};
	const index = await consoleData.json('index.json');
	const target = index ? consoleCanonical(JSON.parse(index), url, '/harness') : undefined;
	if (target) redirect(308, target);
	return {};
}
