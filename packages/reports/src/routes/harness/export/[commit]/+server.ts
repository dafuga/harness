import type { RequestEvent } from '@sveltejs/kit';
import { consoleServer } from '../../../../utils/consoleServer';

/** One recorded verification as the existing portable report, with its media inlined. */
export function GET(event: RequestEvent): Promise<Response> {
	const record = event.url.searchParams.get('record');
	return consoleServer().report(event, event.params.commit ?? '', record);
}
