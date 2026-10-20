/* Node self-check for the frontend validators in easy-setup/ui.js.
   ui.js expects the LuCI runtime globals (L, E, _, document, String.format);
   we stub the minimum needed for module load, then exercise ES.validate.
   Run: node luci-app-easy-setup/tests/validators.test.mjs */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiPath = path.join(here, '..', 'htdocs', 'luci-static', 'resources', 'easy-setup', 'ui.js');

/* ---- minimal LuCI runtime stubs ---- */
globalThis.L = { resource: (p) => '/luci-static/resources/' + p };
const fakeEl = () => ({
	style: {},
	classList: { add() {}, remove() {} },
	appendChild() {},
	addEventListener() {},
});
globalThis.E = () => fakeEl();
globalThis.document = {
	getElementById: () => ({}), /* pretend the CSS link is already injected */
	createElement: () => fakeEl(),
	head: { appendChild() {} },
	body: { appendChild() {} },
	querySelector: () => null,
	addEventListener() {},
	removeEventListener() {},
	documentElement: { clientWidth: 1200 },
};
globalThis.window = { scrollX: 0, scrollY: 0 };
globalThis.location = { protocol: 'http:', port: '', href: 'http://192.168.1.1/x' };
globalThis._ = (s) => s;
if (!String.prototype.format) {
	String.prototype.format = function (...args) {
		let i = 0;
		return this.replace(/%[sd%]/g, (m) => (m === '%%' ? '%' : String(args[i++])));
	};
}

const src = readFileSync(uiPath, 'utf8');
const ES = new Function(src)();

/* ---- tiny assert harness ---- */
let failures = 0;
let count = 0;
const expectErr = (name, got) => {
	count++;
	if (!(typeof got === 'string' && got.length > 0)) {
		failures++;
		console.error('FAIL (should be invalid):', name);
	}
};
const expectOk = (name, got) => {
	count++;
	if (got !== '') {
		failures++;
		console.error('FAIL (should be valid):', name, '->', got);
	}
};

/* private IP rules */
expectOk('192.168.1.2', ES.validate.privateIp('192.168.1.2'));
expectOk('10.0.0.2', ES.validate.privateIp('10.0.0.2'));
expectOk('172.16.0.1', ES.validate.privateIp('172.16.0.1'));
expectOk('172.31.255.254', ES.validate.privateIp('172.31.255.254'));
expectErr('55.1.2.3 (public)', ES.validate.privateIp('55.1.2.3'));
expectErr('8.8.8.8 (public DNS)', ES.validate.privateIp('8.8.8.8'));
expectErr('172.15.0.1 (just below range)', ES.validate.privateIp('172.15.0.1'));
expectErr('172.32.0.1 (just above range)', ES.validate.privateIp('172.32.0.1'));
expectErr('192.168.1.0 (network addr)', ES.validate.privateIp('192.168.1.0'));
expectErr('192.168.1.255 (broadcast)', ES.validate.privateIp('192.168.1.255'));
expectErr('192.168.01.2 (leading zero)', ES.validate.privateIp('192.168.01.2'));
expectErr('256.1.1.1 (octet > 255)', ES.validate.privateIp('256.1.1.1'));
expectErr('192.168.1 (too few parts)', ES.validate.privateIp('192.168.1'));
expectErr('empty', ES.validate.privateIp(''));
expectErr('garbage', ES.validate.privateIp('abc'));

/* hostname rules */
expectOk('OpenWrt-Lab', ES.validate.hostname('OpenWrt-Lab'));
expectOk('single char', ES.validate.hostname('a'));
expectOk('32 chars', ES.validate.hostname('a'.repeat(32)));
expectErr('-bad (leading hyphen)', ES.validate.hostname('-bad'));
expectErr('bad- (trailing hyphen)', ES.validate.hostname('bad-'));
expectErr('33 chars', ES.validate.hostname('a'.repeat(33)));
expectErr('empty', ES.validate.hostname(''));
expectErr('under_score', ES.validate.hostname('under_score'));

/* password rules */
expectOk('8 chars', ES.validate.password('12345678'));
expectErr('7 chars', ES.validate.password('1234567'));
expectErr('empty', ES.validate.password(''));

/* ssid rules */
expectOk('MyWifi', ES.validate.ssid('MyWifi'));
expectErr('empty', ES.validate.ssid(''));
expectErr('33 chars', ES.validate.ssid('s'.repeat(33)));

/* wifi key rules */
expectOk('8 chars', ES.validate.wifiKey('12345678'));
expectOk('63 chars', ES.validate.wifiKey('k'.repeat(63)));
expectErr('7 chars', ES.validate.wifiKey('1234567'));
expectErr('64 chars', ES.validate.wifiKey('k'.repeat(64)));

if (failures) {
	console.error(failures + ' of ' + count + ' test(s) failed');
	process.exit(1);
}
console.log('ALL ' + count + ' FRONTEND VALIDATOR TESTS PASSED');
