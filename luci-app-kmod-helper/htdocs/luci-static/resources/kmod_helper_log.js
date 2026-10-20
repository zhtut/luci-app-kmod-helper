'use strict';
'require baseclass';
/*
 * Shared in-session debug logger for luci-app-kmod-helper.
 *
 * Collects UI actions and ubus/rpc calls (with arguments, results and
 * timings) in a ring buffer so the "Runtime Logs" page can show them
 * together with the backend log file (/tmp/kmod-helper.log).
 *
 * NOTE: LuCI's module loader validates required modules with
 * Class.isSubclass(), so the factory MUST return a baseclass subclass
 * (plain objects or plain functions raise
 * "factory yields invalid constructor").
 */

var MAX_ENTRIES = 500;
var entries = [];
var seq = 0;

function pad(n, width) {
	var s = String(n);
	width = width || 2;
	while (s.length < width) s = '0' + s;
	return s;
}

function timestamp() {
	var d = new Date();
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
		' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
		'.' + pad(d.getMilliseconds(), 3);
}

function describe(value, limit) {
	var s;
	if (value === undefined) return '';
	if (value === null) return 'null';
	if (typeof value === 'string') s = value;
	else if (typeof value !== 'object') s = String(value);
	else {
		try { s = JSON.stringify(value); }
		catch (e) { s = String(value); }
	}
	s = s.replace(/[\r\n]+/g, ' ');
	limit = limit || 400;
	if (s.length > limit) s = s.slice(0, limit) + '…';
	return s;
}

function push(level, category, message) {
	seq += 1;
	var entry = {
		seq: seq,
		time: timestamp(),
		level: level,
		category: category,
		message: message
	};
	entries.push(entry);
	if (entries.length > MAX_ENTRIES)
		entries.splice(0, entries.length - MAX_ENTRIES);
	if (window.console) {
		if (level === 'error') console.error('[kmod-helper] ' + category + ': ' + message);
		else if (level === 'warn') console.warn('[kmod-helper] ' + category + ': ' + message);
		else console.debug('[kmod-helper] ' + category + ': ' + message);
	}
	return entry;
}

/* Wrap an rpc.declare()d function: logs call, args, result summary or error. */
function rpc(label, fn, args) {
	args = args || [];
	push('info', 'rpc', 'call ' + label + (args.length ? ' args=' + describe(args) : ''));
	var t0 = Date.now();
	return fn.apply(null, args).then(function(res) {
		var ok = !res || res.success === undefined || !!res.success;
		push(ok ? 'info' : 'warn', 'rpc',
			(ok ? 'ok ' : 'warn ') + label + ' (' + (Date.now() - t0) + 'ms) ' + describe(res));
		return res;
	}).catch(function(err) {
		push('error', 'rpc', 'fail ' + label + ' (' + (Date.now() - t0) + 'ms): ' + describe(err && err.message ? err.message : err));
		throw err;
	});
}

/* Log a user interaction / UI state change. */
function ui(level, message) {
	push(level, 'ui', message);
}

function getEntries() {
	return entries.slice();
}

function clear() {
	entries = [];
	push('info', 'log', 'frontend session log cleared');
}

var methods = {
	push: push,
	rpc: rpc,
	ui: ui,
	describe: describe,
	timestamp: timestamp,
	getEntries: getEntries,
	clear: clear
};

var Logger = baseclass.extend(methods);

/* Also install the API as static members so the module works no matter
 * whether the loader injects the class itself or an instance of it. */
for (var k in methods)
	Logger[k] = methods[k];

return Logger;
