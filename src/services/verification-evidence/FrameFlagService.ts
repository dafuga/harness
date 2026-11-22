// @harness-uid u_zhz7hjx43x
import { randomUUID } from 'node:crypto';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import {
	defaultAttachedReader,
	extractFlagFrame,
	inspectFrameClip,
	materializeFlagFrame,
	retainedFlagFrame
} from './frame-flag-service/flagMedia';
import {
	addressedFlags,
	boundClip,
	currentSchema,
	frameHash,
	framePosition,
	inputSchema,
	ownerSchema,
	parseFlagValue,
	referenceSchema
} from './frame-flag-service/flagSchema';
import {
	readFrameFlags,
	storeFrameFlag,
	storeFrameResolution
} from './frame-flag-service/flagStore';
import type {
	FrameClipReader,
	FrameClipReference,
	FrameCurrentClip,
	FrameFeedback,
	FrameFlag,
	FrameFlagInput,
	LoadedFrameClip,
	StoredFrameFlag
} from './FrameFlagService.types';

export class FrameFlagService {
	constructor(
		private readonly root: string = process.cwd(),
		private readonly reader: FrameClipReader = defaultAttachedReader
	) {}

	run(): string {
		return 'frame-flag';
	}

	async flag(input: FrameFlagInput): Promise<FrameFlag> {
		const parsed = parseFlagValue(inputSchema, input);
		const { clip, facts } = await this.load(parsed.clip);
		const position = framePosition(parsed, facts);
		const png = extractFlagFrame(clip, position.frameNumber);
		const flag: StoredFrameFlag = {
			schemaVersion: 1,
			id: randomUUID(),
			clip: { ...parsed.clip, sha256: clip.sha256, inputHash: clip.inputHash },
			...position,
			...(parsed.region ? { region: parsed.region } : {}),
			note: parsed.note ?? '',
			source: parsed.source ?? 'human',
			createdAt: new Date().toISOString(),
			status: 'active',
			frame: {
				file: 'frame.png',
				sha256: frameHash(png),
				bytes: png.length,
				mediaType: 'image/png'
			}
		};
		return storeFrameFlag(this.root, flag, png);
	}

	async list(unit: string, current: FrameCurrentClip[] = []): Promise<FrameFlag[]> {
		parseFlagValue(ownerSchema, unit);
		const slots = parseFlagValue(currentSchema, current);
		return (
			await readFrameFlags(
				this.root,
				this.reader === defaultAttachedReader ? undefined : this.reader,
				unit
			)
		)
			.filter((flag) => flag.clip.unit === unit)
			.map((flag) => {
				const changed = slots.some(
					(slot) =>
						slot.clipId === flag.clip.clipId &&
						slot.viewport === flag.clip.viewport &&
						slot.sha256 !== flag.clip.sha256
				);
				if (flag.status !== 'resolved' && changed) return { ...flag, status: 'stale' };
				return flag;
			});
	}

	async feedback(unit: string, directory: string): Promise<FrameFeedback> {
		if (typeof directory !== 'string' || !directory.trim())
			throw new ExpectedCliError('Feedback requires a task-owned input directory.');
		const flags = (await this.list(unit)).filter((flag) => flag.status !== 'resolved');
		const images: string[] = [];
		for (const flag of flags) images.push(await materializeFlagFrame(this.root, flag, directory));
		return {
			text: flags.map(feedbackText).join('\n'),
			images,
			flags: flags.map((flag) => flag.id)
		};
	}

	async frame(unit: string, id: string): Promise<Buffer> {
		const flag = (await this.list(unit)).find((item) => item.id === id);
		if (!flag) throw new ExpectedCliError('Frame flag was not found for this owner.');
		return retainedFlagFrame(this.root, flag);
	}

	async address(reference: FrameClipReference): Promise<FrameFlag[]> {
		const { clip } = await this.load(parseFlagValue(referenceSchema, reference));
		const flags = addressedFlags(clip, await this.list(clip.unit));
		for (const flag of flags.filter((flag) => flag.status !== 'resolved'))
			await storeFrameResolution(this.root, flag, clip);
		return (await this.list(clip.unit)).filter((flag) => clip.addressedFlags.includes(flag.id));
	}

	private async load(reference: FrameClipReference): Promise<LoadedFrameClip> {
		try {
			const read =
				this.reader === defaultAttachedReader
					? await defaultAttachedReader(reference, this.root)
					: await this.reader(reference);
			const clip = boundClip(reference, read);
			return { clip, facts: inspectFrameClip(clip) };
		} catch (error) {
			if (error instanceof ExpectedCliError) throw error;
			throw new ExpectedCliError(
				`Invalid attached clip evidence: ${error instanceof Error ? error.message : 'reader failed'}`
			);
		}
	}
}

function feedbackText(flag: FrameFlag): string {
	return JSON.stringify({
		flag: flag.id,
		unit: flag.clip.unit,
		clipId: flag.clip.clipId,
		viewport: flag.clip.viewport,
		record: flag.clip.record,
		revision: flag.clip.revision,
		sha256: flag.clip.sha256,
		inputHash: flag.clip.inputHash,
		atSeconds: flag.atSeconds,
		frameNumber: flag.frameNumber,
		region: flag.region ?? null,
		note: flag.note,
		source: flag.source
	});
}
