// @harness-uid u_3kncmpwgff
export class UnsupportedRecordKindError extends Error {
	override name = 'UnsupportedRecordKindError';
}

export class MissingRecordDataError extends Error {
	override name = 'MissingRecordDataError';
}

export class MissingSummaryTextError extends Error {
	override name = 'MissingSummaryTextError';
}

export class InvalidAcceptanceCriteriaError extends Error {
	override name = 'InvalidAcceptanceCriteriaError';
}

export class MissingRecordTitleError extends Error {
	override name = 'MissingRecordTitleError';
}

export class InvalidRecordStatusError extends Error {
	override name = 'InvalidRecordStatusError';
}

export class InvalidEvidenceStatusError extends Error {
	override name = 'InvalidEvidenceStatusError';
}

export class MissingEvidencePathError extends Error {
	override name = 'MissingEvidencePathError';
}

export class InvalidEvidencePhaseError extends Error {
	override name = 'InvalidEvidencePhaseError';
}

export class InvalidAudioDurationError extends Error {
	override name = 'InvalidAudioDurationError';
}

export class InvalidAudioTranscriptError extends Error {
	override name = 'InvalidAudioTranscriptError';
}
