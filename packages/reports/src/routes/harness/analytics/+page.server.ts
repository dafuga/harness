import { HarnessAnalyticsService } from '../../../services/HarnessAnalyticsService';
import { siteActivity } from '../../../utils/siteActivity';
export async function load({ url }: { url: URL }) {
	const [analytics, project] = await Promise.all([
		new HarnessAnalyticsService().snapshot(url.searchParams),
		siteActivity()
	]);
	return { analytics, project: project ?? null };
}
