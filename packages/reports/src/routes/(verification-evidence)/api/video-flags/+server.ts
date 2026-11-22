// @harness-uid u_udyzin5pcn
import { json } from '@sveltejs/kit';
import { FrameFlagService } from '../../../../../../../src/services/verification-evidence/FrameFlagService';
import { reportSite } from '../../../../utils/reports-media/reportSite';
import { readFlagRequest } from './flagRequest';

/** The global owner hook guards this route before any repository is opened. */
export async function GET({ url }: { url: URL }): Promise<Response> {
	try {
		const unit = url.searchParams.get('unit') ?? '';
		const clipId = url.searchParams.get('clipId'),
			viewport = url.searchParams.get('viewport');
		const sha256 = url.searchParams.get('sha256');
		const current = clipId && viewport && sha256 ? [{ clipId, viewport, sha256 }] : [];
		if ([clipId, viewport, sha256].some(Boolean) && current.length === 0)
			return json({ error: 'Current clip requires clipId, viewport and sha256' }, { status: 400 });
		const flags = await new FrameFlagService(reportSite().root).list(unit, current);
		return json({
			flags: flags.filter(
				(flag) => !clipId || (flag.clip.clipId === clipId && flag.clip.viewport === viewport)
			)
		});
	} catch (reason) {
		return flagFailure(reason);
	}
}

export async function POST({ request, url }: { request: Request; url: URL }): Promise<Response> {
	try {
		const input = await readFlagRequest(request, url.origin);
		if (input instanceof Response) return input;
		const flag = await new FrameFlagService(reportSite().root).flag(input);
		return json({ flag }, { status: 201 });
	} catch (reason) {
		return flagFailure(reason);
	}
}

function flagFailure(reason: unknown): Response {
	return json(
		{ error: reason instanceof Error ? reason.message : 'Frame feedback unavailable' },
		{ status: 400 }
	);
}
