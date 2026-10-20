'use strict';
'require view';
'require rpc';
'require ui';
'require kmod_helper_log';

var callGetDeviceInfo = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'get_device_info',
	expect: { '': {} }
});

function infoRow(label, value) {
	return E('tr', {}, [
		E('td', { 'class': 'td left', 'style': 'width:33%;font-weight:bold' }, label),
		E('td', { 'class': 'td left' }, value || '-')
	]);
}

return view.extend({
	load: function() {
		kmod_helper_log.ui('info', _('view opened: device overview'));
		return kmod_helper_log.rpc('get_device_info', callGetDeviceInfo, []).catch(function(e) {
			ui.addNotification(null, E('p', _('Failed to load device info: %s').format(e.message || e)), 'error');
			return {};
		});
	},

	render: function(info) {
		info = info || {};
		var rows = [
			infoRow(_('Device Model'), info.model),
			infoRow(_('Firmware Version'), info.release),
			infoRow(_('Target'), info.target),
			infoRow(_('Subtarget'), info.subtarget),
			infoRow(_('Architecture'), info.arch),
			infoRow(_('Kernel Version'), info.kernel),
			infoRow(_('Kernel Vermagic'), info.vermagic),
			infoRow(_('Package Manager'), info.pkg_manager),
			infoRow(_('Current Mirror'), info.mirror)
		];

		var hint = '';
		if (info.release && info.release.indexOf('SNAPSHOT') !== -1) {
			hint = _('Snapshot firmware detected: multiple kernel builds may exist on the mirror. The best-matching kernel directory will be selected automatically on the Install page.');
		} else {
			hint = _('Release firmware detected: the mirror usually provides a single kernel directory matching your kernel vermagic.');
		}

		return E('div', {}, [
			E('h2', {}, _('Kernel Module Helper')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Device & Kernel Information')),
				E('table', { 'class': 'table' }, rows)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, hint),
				E('div', { 'style': 'margin-top:1em' }, [
					E('a', { 'class': 'btn cbi-button cbi-button-action', 'href': '#system/kmod-helper/install' }, _('Go to Install Kmods')),
					' ',
					E('a', { 'class': 'btn cbi-button', 'href': '#system/kmod-helper/mirror' }, _('Mirror Settings'))
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
