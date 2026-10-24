# APIs catalog and page usage

The selected project and revision list indexed HTTP endpoints as APIs, including route, method exports, contract and consumers. Pages have a separate APIs tab showing source-proven direct and transitive requests through components/services. Links, refresh and revision changes retain scope; earlier revisions never show later endpoints. Empty usage states say what is recorded rather than claiming no runtime calls exist.

Coverage gap: endpoint units were classified as services (whose admission excludes endpoints), fetch calls did not enter the source graph, and page navigation had no APIs tab. Existing catalog components, contracts, selectors and relation cards are reused.

Frozen regressions: source scanner and owning-workspace index, route/tab parser, shared catalog relationships, and the standard entity browser matrix at desktop/tablet/mobile. Browser fixtures are synthetic history rendered by the actual shared UI, not deployed project evidence. Automated E2Es execute only on harbor-mbp-2. The red run captures the Pages entry before asserting the missing APIs link.

Broader gate remains pending until bun run check passes. Previous CLI work identified two root-suite failures independently reproduced on main; preserve those assertions and report their scope if they persist.
