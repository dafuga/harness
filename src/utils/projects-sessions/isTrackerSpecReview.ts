// @harness-uid u_t332so7lwh
const spec = /\bspec(?:s|ification|ifications)?\b/i;
const decision = /\b(?:review(?:ed|ing)?|approv(?:e|es|ed|al)|sign[- ]?off|accept|merge)\b/i;

/** @pure True when an ask is about reviewing a spec, so Daniel has to be able to read it. */
export function isTrackerSpecReview(question: string, labels: readonly string[]): boolean {
	return spec.test(question) && [question, ...labels].some((text) => decision.test(text));
}
