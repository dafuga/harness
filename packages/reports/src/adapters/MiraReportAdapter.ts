import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ReportRepository } from '../repositories/ReportRepository';
type MiraAsset = {
	number: number;
	file: string;
	caption: string;
	category: string;
	source?: string;
	capturedAt?: string;
};
type MiraFinding = { id: string; status: string; detail: string };
export class MiraReportAdapter {
	async ingest(store: ReportRepository, id: string, file: string, findingsFile?: string) {
		const assets = JSON.parse(await readFile(file, 'utf8')) as MiraAsset[];
		for (const asset of assets) await this.asset(store, id, file, asset);
		if (findingsFile) await this.findings(store, id, findingsFile);
		await store.record(id, {
			kind: 'check',
			data: {
				id: 'historical-import',
				title: 'Historical screenshot archive imported',
				status: 'passed',
				counts: { screenshots: assets.length },
				group: 'Import only - prior checks not rerun'
			}
		});
		return { evidence: assets.length };
	}
	private async asset(store: ReportRepository, id: string, file: string, asset: MiraAsset) {
		await store.record(id, {
			kind: 'evidence',
			data: {
				id: `mira-${String(asset.number).padStart(3, '0')}`,
				title: asset.caption,
				category: asset.category,
				path: join(dirname(file), asset.file),
				source: asset.source,
				capturedAt: asset.capturedAt,
				order: asset.number,
				status: 'passed',
				note: 'Historical production capture; current behavior not retested.'
			}
		});
	}
	private async findings(store: ReportRepository, id: string, file: string) {
		const data = JSON.parse(await readFile(file, 'utf8')) as {
			scenesPlayed?: number;
			requestedScenes?: number;
			issues?: MiraFinding[];
		};
		for (const issue of data.issues || [])
			await store.record(id, {
				kind: 'finding',
				data: {
					id: issue.id,
					title: issue.id.replaceAll('-', ' '),
					detail: issue.detail,
					status: issue.status === 'unresolved' ? 'failed' : 'passed'
				}
			});
		await store.record(id, {
			kind: 'coverage',
			data: {
				id: 'scene-count',
				title: 'Requested scene playthrough',
				status: data.scenesPlayed === data.requestedScenes ? 'passed' : 'failed',
				detail: `${data.scenesPlayed || 0} of ${data.requestedScenes || 0} requested scenes recorded.`
			}
		});
	}
}
