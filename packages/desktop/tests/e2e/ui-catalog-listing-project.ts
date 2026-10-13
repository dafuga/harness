import { listingProject } from '../../test/catalog-listing-fixture';
import { analytics } from '../../test/catalog-listing-manifests';

/**
 * TEST ONLY. Prints what the real session answers for a disposable Git project: the snapshot of
 * its tip and of the earlier commit, and the detail of the identity that is a page only at the
 * earlier one. A browser test shows exactly these; no entity among them is written by hand.
 */
const made = await listingProject();
try {
	const project = { name: 'Former addresses', root: '/tmp/disposable-harness' };
	const earlier = await made.session.snapshot({ branch: 'main', commit: made.then });
	const tip = await made.session.snapshot({ branch: null, commit: null });
	const details = {
		[made.tip]: await made.catalog.entity(analytics, made.tip),
		[made.then]: await made.catalog.entity(analytics, made.then)
	};
	console.log(
		JSON.stringify({ tip: { ...tip, project }, earlier: { ...earlier, project }, details })
	);
} finally {
	await made.close();
}
