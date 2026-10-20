'use strict';
'require view';
'require rpc';
'require ui';
'require kmod_helper_log';

/* Theme-neutral pre style: works on both light and dark LuCI themes. */
var PRE_STYLE = 'max-height:24em;overflow:auto;background:rgba(128,128,128,0.15);' +
	'color:inherit;padding:0.5em;margin-top:0.5em;white-space:pre-wrap';

var callLsmod = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'list_loaded_modules',
	expect: { '': {} }
});

var callDmesg = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'get_dmesg',
	params: ['lines'],
	expect: { '': {} }
});

var callModinfo = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'get_modinfo',
	params: ['module'],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		kmod_helper_log.ui('info', _('view opened: kernel tools'));
		return Promise.all([
			kmod_helper_log.rpc('list_loaded_modules', callLsmod, []).catch(function() { return { modules: [] }; }),
			kmod_helper_log.rpc('get_dmesg', callDmesg, [200]).catch(function() { return { log: '' }; })
		]);
	},

	render: function(results) {
		var self = this;
		var lsmod = results[0] || { modules: [] };
		var dmesg = results[1] || { log: '' };

		kmod_helper_log.ui('info', _('lsmod: %d module(s), dmesg: %d byte(s)')
			.format((lsmod.modules || []).length, (dmesg.log || '').length));

		var modRows = (lsmod.modules || []).map(function(m) {
			return E('tr', {}, [
				E('td', { 'class': 'td left' }, m.name),
				E('td', { 'class': 'td left' }, m.size),
				E('td', { 'class': 'td left' }, m.used)
			]);
		});
		var lsmodTable = modRows.length ? E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, _('Module')),
				E('th', { 'class': 'th left' }, _('Size')),
				E('th', { 'class': 'th left' }, _('Used by'))
			])
		].concat(modRows)) : E('div', { 'class': 'cbi-section-descr' }, _('No loaded modules or lsmod unavailable.'));

		var dmesgPre = E('pre', { 'style': PRE_STYLE }, dmesg.log || _('No kernel log.'));

		/* Hidden until the first query so the page shows no empty box/line. */
		var modinfoOut = E('pre', { 'style': PRE_STYLE, 'hidden': '' }, '');

		var modinfoInput = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'placeholder': 'wireguard', 'style': 'width:16em' });
		function doModinfo() {
			var name = modinfoInput.value.trim();
			if (!name) return;
			kmod_helper_log.ui('info', _('click: modinfo %s').format(name));
			modinfoOut.hidden = false;
			modinfoOut.textContent = _('Loading...');
			kmod_helper_log.rpc('get_modinfo', callModinfo, [name]).then(function(res) {
				modinfoOut.textContent = (res && res.success) ? res.info : ((res && res.error) || _('No info'));
			}).catch(function(e) {
				modinfoOut.textContent = _('Error: %s').format(e.message || e);
			});
		}
		modinfoInput.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') doModinfo(); });

		function loadDmesg() {
			kmod_helper_log.ui('info', _('click: refresh dmesg'));
			dmesgPre.textContent = _('Loading...');
			kmod_helper_log.rpc('get_dmesg', callDmesg, [200]).then(function(res) {
				dmesgPre.textContent = (res && res.log) ? res.log : _('No kernel log.');
			}).catch(function(e) {
				dmesgPre.textContent = _('Error: %s').format(e.message || e);
			});
		}
		var refreshDmesg = E('button', { 'class': 'btn cbi-button', 'click': loadDmesg }, _('Refresh'));

		return E('div', {}, [
			E('h2', {}, _('Kernel Tools')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Loaded Kernel Modules (lsmod)')),
				lsmodTable
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Module Information (modinfo)')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Module Name')),
					E('div', { 'class': 'cbi-value-field' }, [
						modinfoInput, ' ',
						E('button', { 'class': 'btn cbi-button', 'click': doModinfo }, _('Query'))
					])
				]),
				modinfoOut
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Kernel Log (dmesg)')),
				E('div', { 'style': 'margin-bottom:0.5em' }, [ refreshDmesg ]),
				dmesgPre
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
