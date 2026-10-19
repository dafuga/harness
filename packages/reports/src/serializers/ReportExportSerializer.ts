import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../models/Report.types';
import { registeredAsset } from '../utils/reportAssets';
import { mediaMime } from '../utils/evidenceMedia';
import { portablePage } from "../utils/console-server/portablePage";
import { type PortableAssets } from "../utils/portablePage";
export class ReportExportSerializer {
	constructor(private readonly appRoot: string) {}
	async html(report: Report, directory: string) {
		const portable = structuredClone(report);
		for (const item of portable.evidence) {
			if (item.missing) continue;
			const path = await registeredAsset(
				join(directory, 'assets'),
				item.file,
				report.evidence.map((value) => value.file)
			);
			const mime = mediaMime(item.file);
			item.file = `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
		}
		return this.page(portable);
	}
	/** Wraps a report whose media is already inline into one self-contained page. */
	async page(portable: Report) {
		return portablePage(portable, await this.assets());
	}
	/** The compiled viewer this application ships, read from its build output. */
	async assets(): Promise<PortableAssets> {
		const bundle = join(this.appRoot, 'dist', 'viewer');
		const [script, style] = await Promise.all([
			readFile(join(bundle, 'report.iife.js'), 'utf8'),
			readFile(join(bundle, 'report.css'), 'utf8')
		]);
		return { script, style };
	}
}
