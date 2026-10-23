import {
	ipcFields,
	textField,
	enumField,
	commitPattern
} from '../../utils/development-tooling/ipcFields';
import { assertDocument } from '../../../../game/src/validators/game-authoring/gameDocument';
import { validateSession } from '../../../../game/src/adapters/agents-providers/DecartAdapter';
import type { RenderSessionRequest } from '../../../../game/src/models/game-authoring/Game.types';
/** Private to IpcRequestValidator: sanitize a game request or throw before service execution. */
export function gamePayload(channel: string, input: unknown): unknown {
	const x = ipcFields(input);
	if (channel === 'game:create')
		return {
			name: textField(x.name, 80, /^[a-z][a-z0-9-]*$/),
			kind: enumField(x.kind, ['app', 'game']),
			dimension: enumField(x.dimension, ['2d', '3d'])
		};
	const projectId = textField(x.projectId, 128, /^local-[a-f0-9]{64}$/);
	if (channel === 'game:read')
		return {
			projectId,
			...(x.commit === undefined ? {} : { commit: textField(x.commit, 40, commitPattern) })
		};
	if (channel === 'game:image-read')
		return {
			projectId,
			path: textField(x.path, 100, /^static\/game\/checkpoints\/[a-f0-9]{64}\.png$/),
			...(x.commit === undefined ? {} : { commit: textField(x.commit, 40, commitPattern) })
		};
	if (channel === 'game:level-generate') return levelRequest(projectId, x);
	if (channel === 'game:image-generate') {
		assertDocument(x.document);
		return {
			projectId,
			document: x.document,
			viewId: textField(x.viewId, 200),
			checkpointId: textField(x.checkpointId, 200),
			expectedRevision: textField(x.expectedRevision, 64, /^[a-f0-9]{64}$/)
		};
	}
	if (channel === 'game:save') {
		assertDocument(x.document);
		return {
			projectId,
			document: x.document,
			expectedRevision: textField(x.expectedRevision, 64, /^[a-f0-9]{64}$/)
		};
	}
	const request = {
		projectId,
		model: enumField(x.model, ['lucy-restyle-2', 'lucy-2.5']),
		fast: x.fast,
		seconds: x.seconds
	} as RenderSessionRequest;
	validateSession(request);
	return request;
}

function levelRequest(projectId: string, x: ReturnType<typeof ipcFields>) {
	assertDocument(x.document);
	return {
		projectId,
		document: x.document,
		viewId: textField(x.viewId, 200),
		expectedRevision: textField(x.expectedRevision, 64, /^[a-f0-9]{64}$/),
		provider: enumField(x.provider, ['codex', 'claude']),
		model: textField(x.model, 200),
		...(x.feedback === undefined ? {} : { feedback: textField(x.feedback, 4000) })
	};
}
