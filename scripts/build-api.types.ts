// @harness-uid u_gq3kw7cl76
export class ApiDeclarationBuildError extends Error {
	override name = 'ApiDeclarationBuildError';
}

export class PublicApiBundleBuildError extends Error {
	override name = 'PublicApiBundleBuildError';
}

export class EdgeBundleBuildError extends Error {
	override name = 'EdgeBundleBuildError';
}

export class EdgeBundlePortabilityError extends Error {
	override name = 'EdgeBundlePortabilityError';
}
