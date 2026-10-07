import { HarnessAnalyticsService } from '../../services/HarnessAnalyticsService';
export async function load({ url }: { url: URL }) {
	return { analytics: await new HarnessAnalyticsService().snapshot(url.searchParams) };
}
