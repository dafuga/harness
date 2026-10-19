import { GatherResult, Gathered } from '../../utils/gatherCaptures';
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureIndex, captureLineSchema, type CaptureLine } from "../../core/verifyTypes";
import type { Capture } from "../../core/verificationTypes";
import { mediaFacts } from "./mediaFacts";
import { type MediaFacts } from "../../utils/mediaFacts";

const hex = /^[0-9a-f]{40}$/;

/** Reads what one check wrote to its evidence directory and inspects every file it names. */
export function gatherCaptures(directory: string, recordPath: string): GatherResult {
	const index = join(directory, captureIndex);
	const result: GatherResult = { gathered: [], failures: [] };
	const lines = existsSync(index) ? readFileSync(index, 'utf8').split('\n').filter(Boolean) : [];
	for (const text of lines) {
		const parsed = captureLineSchema.safeParse(parseJson(text));
		const file = parsed.success ? join(directory, parsed.data.file) : '';
		if (!parsed.success) result.failures.push('wrote a malformed capture line');
		else if (!existsSync(file))
			result.failures.push(`declared capture ${parsed.data.file} but wrote no file`);
		else result.gathered.push(inspect(parsed.data, readFileSync(file), recordPath));
	}
	return result;
}

function inspect(line: CaptureLine, bytes: Buffer, recordPath: string): Gathered {
	const media = line.kind === 'screenshot' || line.kind === 'audio';
	const facts = media ? mediaFacts(bytes, line.mediaType) : undefined;
	const { file, server, durationSeconds, ...rest } = line;
	const duration = actualDuration(facts) ?? durationSeconds;
	const capture: Capture = {
		...rest,
		status: 'passed',
		path: `${recordPath}/${file}`,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		bytes: bytes.length,
		capturedAt: new Date().toISOString(),
		...(duration === undefined ? {} : { durationSeconds: duration }),
		...(server && hex.test(server.revision) ? { server } : {})
	};
	const benchmark = line.kind === 'benchmark' ? parseJson(bytes.toString('utf8')) : undefined;
	return { line, capture, facts, benchmark };
}

/** The duration the audio really has, which replaces whatever the check declared. */
function actualDuration(facts: MediaFacts | undefined): number | undefined {
	return facts && 'kind' in facts && facts.kind === 'audio' ? facts.durationSeconds : undefined;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}
