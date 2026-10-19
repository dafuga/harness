import { randomUUID } from 'node:crypto';
import type { ReportRepository } from '../repositories/ReportRepository';
import { audioAsset } from '../utils/audioAsset';
import { writeImageAsset } from '../utils/reportAssets';
import { sanitize } from '../utils/sanitize';
interface AudioDetails {
	title: string;
	note: string;
	source: string;
}
export interface AudioUploadInput extends AudioDetails {
	audio: File;
}
export interface AudioComparisonInput extends AudioDetails {
	before: File;
	after: File;
}
function inputDetails(input: AudioDetails) {
	const title = sanitize(input.title.trim());
	if (!title || title.length > 120) throw new Error('Audio title must be 1–120 characters');
	if (input.note.length > 2000 || input.source.length > 200)
		throw new Error('Audio notes or source exceed size limit');
	return {
		title,
		note: sanitize(input.note.trim()),
		source: sanitize(input.source.trim()) || 'Manual audio upload · recording date not supplied'
	};
}
async function readAudio(audio: File) {
	if (!audio.size || audio.size > 50_000_000) throw new Error('Audio file must be 1 byte to 50 MB');
	const bytes = Buffer.from(await audio.arrayBuffer());
	const { name: file, ...metadata } = audioAsset(bytes, audio.name);
	return { bytes, file, metadata };
}
export class AudioUploadService {
	constructor(private readonly repository: ReportRepository) {}
	async upload(reportId: string, input: AudioUploadInput) {
		const details = inputDetails(input);
		const { bytes, file, metadata } = await readAudio(input.audio);
		return this.repository.mutateActive(reportId, async (report, directory) => {
			await writeImageAsset(directory, file, bytes);
			report.evidence.push({
				id: randomUUID(),
				...details,
				...metadata,
				file,
				category: 'Uploaded audio',
				status: 'not-proven'
			});
			report.updatedAt = new Date().toISOString();
		});
	}
	async uploadComparison(reportId: string, input: AudioComparisonInput) {
		const details = inputDetails(input);
		// Validate both original files before writing either or changing the manifest.
		const files = await Promise.all([readAudio(input.before), readAudio(input.after)]);
		const comparison = randomUUID();
		return this.repository.mutateActive(reportId, async (report, directory) => {
			for (const file of files) await writeImageAsset(directory, file.file, file.bytes);
			const phases = ['before', 'after'] as const;
			report.evidence.push(
				...files.map(({ file, metadata }, index) => ({
					id: randomUUID(),
					...details,
					...metadata,
					file,
					comparison,
					phase: phases[index],
					category: 'Uploaded audio',
					status: 'not-proven' as const
				}))
			);
			report.updatedAt = new Date().toISOString();
		});
	}
}
