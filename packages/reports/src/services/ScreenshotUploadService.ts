import { randomUUID } from 'node:crypto';
import type { Evidence } from '../models/Report.types';
import type { ReportRepository } from '../repositories/ReportRepository';
import { imageAsset, writeImageAsset } from '../utils/reportAssets';
import { sanitize } from '../utils/sanitize';
import type { R2ScreenshotStoreAdapter } from '../adapters/R2ScreenshotStoreAdapter';

export interface ScreenshotUploadInput {
	title: string;
	viewport: string;
	before: File;
	after: File;
}

const viewports: Record<string, string> = {
	'': '',
	mobile: '390px mobile',
	tablet: '920px tablet',
	desktop: '1440px desktop'
};

function evidencePair(title: string, viewport: string, before: string, after: string): Evidence[] {
	const comparison = randomUUID();
	const common = {
		category: 'Uploaded comparison',
		status: 'not-proven' as const,
		source: 'Manual upload · Cloudflare R2',
		capturedAt: new Date().toISOString(),
		comparison,
		storage: 'r2' as const,
		...(viewport ? { viewport } : {})
	};
	return [
		{
			...common,
			id: `${comparison}-before`,
			title: `${title} before`,
			phase: 'before',
			file: before
		},
		{ ...common, id: `${comparison}-after`, title: `${title} after`, phase: 'after', file: after }
	];
}

export class ScreenshotUploadService {
	constructor(
		private readonly repository: ReportRepository,
		private readonly storage: Pick<R2ScreenshotStoreAdapter, 'put'>
	) {}
	async upload(reportId: string, input: ScreenshotUploadInput) {
		const title = sanitize(input.title.trim());
		if (!title || title.length > 120) throw new Error('Comparison title must be 1–120 characters');
		if (!(input.viewport in viewports)) throw new Error('Invalid viewport');
		const before = Buffer.from(await input.before.arrayBuffer());
		const after = Buffer.from(await input.after.arrayBuffer());
		const beforeImage = imageAsset(before, input.before.name);
		const afterImage = imageAsset(after, input.after.name);
		return this.repository.mutateActive(reportId, async (report, directory) => {
			await this.storage.put(reportId, beforeImage.name, before, beforeImage.mime);
			await this.storage.put(reportId, afterImage.name, after, afterImage.mime);
			await writeImageAsset(directory, beforeImage.name, before);
			await writeImageAsset(directory, afterImage.name, after);
			report.evidence.push(
				...evidencePair(title, viewports[input.viewport], beforeImage.name, afterImage.name)
			);
			report.updatedAt = new Date().toISOString();
		});
	}
}
