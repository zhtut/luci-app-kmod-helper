'use strict';
'require view';
'require rpc';
'require ui';
'require kmod_helper_log';

var callGetConfig = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'get_config',
	expect: { '': {} }
});

var callSetMirror = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'set_mirror',
	params: ['mirror', 'custom_mirror', 'use_custom'],
	expect: { '': {} }
});

var callTestMirror = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'test_mirror',
	params: ['mirror'],
	expect: { '': {} }
});

var PRESET_MIRRORS = [
	{ name: 'PKU Mirror (Beijing Univ.) - immortalwrt', url: 'https://mirrors.pku.edu.cn/immortalwrt/' }
];

return view.extend({
	load: function() {
		kmod_helper_log.ui('info', _('view opened: mirror settings'));
		return kmod_helper_log.rpc('get_config', callGetConfig, []).catch(function() { return {}; });
	},

	render: function(cfg) {
		cfg = cfg || {};
		var useCustom = (cfg.use_custom === '1');
		var presetUrl = cfg.mirror || PRESET_MIRRORS[0].url;
		var customUrl = cfg.custom_mirror || '';

		var presetSel = E('select', { 'class': 'cbi-input-select', 'id': 'preset-mirror', 'style': 'width:26em' },
			PRESET_MIRRORS.map(function(m) {
				return E('option', { 'value': m.url, 'selected': (m.url === presetUrl) ? '' : null }, m.name + ' (' + m.url + ')');
			})
		);

		var customInput = E('input', {
			'class': 'cbi-input-text',
			'id': 'custom-mirror',
			'type': 'text',
			'style': 'width:26em',
			'placeholder': 'https://example.com/immortalwrt/',
			'value': customUrl
		});

		var radioPreset = E('input', { 'type': 'radio', 'name': 'mirror-type', 'id': 'type-preset', 'checked': !useCustom ? '' : null });
		var radioCustom = E('input', { 'type': 'radio', 'name': 'mirror-type', 'id': 'type-custom', 'checked': useCustom ? '' : null });

		function updateState() {
			customInput.disabled = !radioCustom.checked;
			presetSel.disabled = !radioPreset.checked;
		}
		radioPreset.addEventListener('change', updateState);
		radioCustom.addEventListener('change', updateState);
		updateState();

		var statusEl = E('span', { 'style': 'margin-left:1em' }, '');

		function currentUrl() {
			var isCustom = radioCustom.checked;
			var url = isCustom ? customInput.value.trim() : presetSel.value;
			if (url && url.charAt(url.length - 1) !== '/') url += '/';
			return url;
		}

		function doSave() {
			var isCustom = radioCustom.checked;
			var url = currentUrl();
			kmod_helper_log.ui('info', _('click: Save & Apply (type=%s, url=%s)').format(isCustom ? 'custom' : 'preset', url));
			if (!url) {
				ui.addNotification(null, E('p', _('Please enter a mirror URL.')), 'error');
				return;
			}
			ui.showModal(_('Saving'), [E('p', { 'class': 'spinning' }, _('Saving mirror settings...'))]);
			kmod_helper_log.rpc('set_mirror', callSetMirror, [presetSel.value, customInput.value.trim(), isCustom ? '1' : '0']).then(function(res) {
				ui.hideModal();
				if (res && res.success) {
					kmod_helper_log.ui('info', _('mirror saved: %s').format(res.effective_mirror || url));
					ui.addNotification(null, E('p', _('Mirror saved and applied immediately: %s').format(res.effective_mirror || url)), 'info');
				} else {
					kmod_helper_log.ui('error', _('mirror save failed: %s').format((res && res.error) || _('unknown')));
					ui.addNotification(null, E('p', _('Failed to save mirror.') + ' ' + ((res && res.error) || '')), 'error');
				}
			}).catch(function(e) {
				ui.hideModal();
				kmod_helper_log.ui('error', _('mirror save error: %s').format(e.message || e));
				ui.addNotification(null, E('p', _('Error: %s').format(e.message || e)), 'error');
			});
		}

		function doTest() {
			var url = currentUrl();
			kmod_helper_log.ui('info', _('click: Test Connectivity (url=%s)').format(url));
			if (!url) return;
			statusEl.textContent = _('Testing...');
			statusEl.style.color = '';
			kmod_helper_log.rpc('test_mirror', callTestMirror, [url]).then(function(res) {
				if (res && res.success) {
					statusEl.textContent = '✓ ' + _('Mirror is reachable');
					statusEl.style.color = 'green';
				} else {
					statusEl.textContent = '✗ ' + _('Mirror is unreachable') +
						((res && res.message) ? '（' + res.message + '）' : '');
					statusEl.style.color = 'red';
				}
			}).catch(function(e) {
				statusEl.textContent = '✗ ' + _('Test failed') + '（' + (e.message || e) + '）';
				statusEl.style.color = 'red';
			});
		}

		return E('div', {}, [
			E('h2', {}, _('Mirror Settings')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' },
					_('Select a preset mirror or enter a custom one. The mirror is used to locate and download kmod kernel module packages. Saved settings take effect immediately (no reboot needed).')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [
						radioPreset, ' ', _('Preset Mirror')
					]),
					E('div', { 'class': 'cbi-value-field' }, presetSel)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [
						radioCustom, ' ', _('Custom Mirror')
					]),
					E('div', { 'class': 'cbi-value-field' }, customInput)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, ''),
					E('div', { 'class': 'cbi-value-field' }, [
						E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': doSave }, _('Save & Apply')),
						' ',
						E('button', { 'class': 'btn cbi-button', 'click': doTest }, _('Test Connectivity')),
						statusEl
					])
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
