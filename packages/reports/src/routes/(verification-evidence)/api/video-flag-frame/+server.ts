// @harness-uid u_tdqgsngwsz
import { json } from '@sveltejs/kit';
import { FrameFlagService } from '../../../../../../../src/services/verification-evidence/FrameFlagService';
import { reportSite } from '../../../../utils/reports-media/reportSite';
import { mediaResponse } from '../../../../utils/development-tooling/mediaResponse';

/** Resolve through stored flag metadata; no client file path is accepted. */
export async function GET({ url, request }: { url: URL; request: Request }): Promise<Response> {
	const unit = url.searchParams.get('unit') ?? '',
		id = url.searchParams.get('id') ?? '';
	if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(unit) || !/^[a-f0-9-]{36}$/.test(id))
		return json({ error: 'Valid frame owner and flag ID required' }, { status: 400 });
	try {
		const bytes = await new FrameFlagService(reportSite().root).frame(unit, id);
		return mediaResponse(bytes, 'image/png', request.headers.get('range'));
	} catch (reason) {
		const message = reason instanceof Error ? reason.message : 'Frame unavailable';
		return json({ error: message }, { status: message.includes('not found') ? 404 : 400 });
	}
}
