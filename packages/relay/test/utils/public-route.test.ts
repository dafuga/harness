import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../specification/units/relay.function.public-route.json' with { type: 'json' };
import { publicRoute } from '../../src/utils/publicRoute';

/** Passes the authored method and pathname to the imported route parser unchanged. */
function invokePublicRoute(...input: never[]) {
	const [method, pathname] = input as unknown as Parameters<typeof publicRoute>;
	return publicRoute(method, pathname);
}

/** One registered case per authored Example: supported routes, wrong verbs, boundaries and refusals. */
new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	publicRoute: invokePublicRoute
});
