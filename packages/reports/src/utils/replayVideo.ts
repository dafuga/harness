import { createHash } from "node:crypto";
import type { Report } from "../models/Report.types";
import { replayFrames } from "./replayFrames";

export function replayVideoKey(report: Report) {
	return createHash('sha256')
		.update(
			JSON.stringify(replayFrames(report.evidence).map((f) => [f.item.id, f.item.file])) +
				':3s:1280x720:v2'
		)
		.digest('hex');
}

export { replayVideo } from '../services/replay-video-service/replayVideo';
