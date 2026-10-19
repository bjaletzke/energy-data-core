import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { entsoe, storage, lng, regions, countries } from "../dist/index.js";

assert.equal(storage.toNumber("0"), 0);
assert.equal(storage.toNumber("N/A"), null);
assert.equal(lng.parseLngRow({ inventory: { lng: "40" }, dtmi: { lng: "80" } }).full, 50);
assert.equal(regions.sumOrNull([null, null], value => value), null);
assert.equal(countries.countryNameOf("de"), "Germany");
assert.deepEqual(entsoe.sumPoints([[{ ts: 0, value: null }]]), { points: [{ ts: 0, value: null }], coverage: [{ present: 0, of: 1 }] });

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8" }))[0];
assert(packed.files.length > 0);
for (const { path } of packed.files) {
  assert(/^(?:dist\/.*\.(?:js|d\.ts)|README\.md|CHANGELOG\.md|CONTRIBUTING\.md|SECURITY\.md|THIRD_PARTY_NOTICES\.md|LICENSE|docs\/[A-Z]+\.md|package\.json)$/.test(path), `Unexpected package entry: ${path}`);
}
console.log(`Node ESM consumer passed; npm package allowlist passed (${packed.files.length} files).`);
