import type { siteActivity } from '../../src/routes/api/project-activity/siteActivity';

export type SiteActivityResult = Awaited<ReturnType<typeof siteActivity>>;
