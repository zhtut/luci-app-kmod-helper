'use strict';
'require view';
'require rpc';
'require ui';
'require kmod_helper_log';

var PRE_STYLE = 'max-height:30em;overflow:auto;background:rgba(128,128,128,0.15);' +
	'color:inherit;padding:0.5em;white-space:pre-wrap';

var callGetLog = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'get_log',
	params: ['lines'],
	expect: { '': {} }
});

var callClearLog = rpc.declare({
	object: 'luci.kmod-helper',
	method: 'clear_log',
	expect: { '': {} }
});

return view.extend({
	autoTimer: null,

	load: function() {
		kmod_helper_log.ui('info', _('view opened: runtime logs'));
		return kmod_helper_log.rpc('get_log', callGetLog, [1000]).catch(function() { return { log: '' }; });
	},

	buildFrontTable: function() {
		var entries = kmod_helper_log.getEntries();
		if (!entries.length) {
			return E('div', { 'class': 'cbi-section-descr' }, _('No frontend log entries yet.'));
		}
		var rows = entries.map(function(e) {
			return E('tr', {}, [
				E('td', { 'class': 'td left', 'style': 'white-space:nowrap' }, e.time),
				E('td', { 'class': 'td left' }, e.level),
				E('td', { 'class': 'td left' }, e.category),
				E('td', { 'class': 'td left' }, E('small', {}, e.message))
			]);
		});
		return E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, _('Time')),
				E('th', { 'class': 'th left' }, _('Level')),
				E('th', { 'class': 'th left' }, _('Category')),
				E('th', { 'class': 'th left' }, _('Message'))
			])
		].concat(rows));
	},

	refreshFront: function() {
		var box = document.getElementById('kmod-log-front');
		if (!box) return;
		while (box.firstChild) box.removeChild(box.firstChild);
		box.appendChild(this.buildFrontTable());
	},

	refreshBackend: function(preEl, pathEl) {
		var self = this;
		return kmod_helper_log.rpc('get_log', callGetLog, [1000]).then(function(res) {
			preEl.textContent = (res && res.log) ? res.log : _('No backend log yet.');
			if (pathEl && res && res.path) pathEl.textContent = res.path;
		}).catch(function(e) {
			preEl.textContent = _('Error: %s').format(e.message || e);
		});
	},

	render: function(backend) {
		var self = this;
		backend = backend || {};

		var frontBox = E('div', { 'id': 'kmod-log-front' }, [ this.buildFrontTable() ]);
		var backendPre = E('pre', { 'style': PRE_STYLE }, backend.log || _('No backend log yet.'));
		var backendPath = E('small', {}, backend.path || '/tmp/kmod-helper.log');

		function doRefresh() {
			kmod_helper_log.ui('info', _('click: refresh runtime logs'));
			self.refreshFront();
			self.refreshBackend(backendPre, backendPath);
		}

		function doDownload() {
			kmod_helper_log.ui('info', _('click: download log'));
			var lines = [];
			lines.push('# luci-app-kmod-helper runtime log');
			lines.push('# exported: ' + kmod_helper_log.timestamp());
			lines.push('');
			lines.push('===== frontend session log =====');
			kmod_helper_log.getEntries().forEach(function(e) {
				lines.push(e.time + ' [' + e.level + '] [' + e.category + '] ' + e.message);
			});
			lines.push('');
			lines.push('===== backend log (' + (backend.path || '/tmp/kmod-helper.log') + ') =====');
			lines.push(backendPre.textContent || '');
			var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
			var a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = 'kmod-helper-log-' + Date.now() + '.txt';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(a.href);
		}

		function doClear() {
			kmod_helper_log.ui('info', _('click: clear backend log'));
			kmod_helper_log.rpc('clear_log', callClearLog, []).then(function(res) {
				if (res && res.success) {
					ui.addNotification(null, E('p', _('Backend log cleared.')), 'info');
					self.refreshBackend(backendPre, backendPath);
				} else {
					ui.addNotification(null, E('p', _('Failed to clear backend log: %s').format((res && res.error) || _('unknown'))), 'error');
				}
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to clear backend log: %s').format(e.message || e)), 'error');
			});
		}

		var autoChk = E('input', { 'type': 'checkbox', 'id': 'kmod-log-auto' });
		autoChk.addEventListener('change', function() {
			if (self.autoTimer) {
				clearInterval(self.autoTimer);
				self.autoTimer = null;
			}
			if (autoChk.checked) {
				kmod_helper_log.ui('info', _('auto refresh enabled (5s)'));
				self.autoTimer = setInterval(function() {
					if (!document.getElementById('kmod-log-front')) {
						clearInterval(self.autoTimer);
						self.autoTimer = null;
						return;
					}
					self.refreshFront();
					self.refreshBackend(backendPre, backendPath);
				}, 5000);
			} else {
				kmod_helper_log.ui('info', _('auto refresh disabled'));
			}
		});

		return E('div', {}, [
			E('h2', {}, _('Runtime Logs')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' },
					_('Frontend session log (since page load) and backend log from %s. Download everything and share it when reporting a problem.').format('/tmp/kmod-helper.log')),
				E('div', { 'style': 'margin-bottom:0.5em' }, [
					E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': doRefresh }, _('Refresh')),
					' ',
					E('button', { 'class': 'btn cbi-button', 'click': doDownload }, _('Download Log')),
					' ',
					E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': doClear }, _('Clear Backend Log')),
					' ',
					E('label', { 'style': 'margin-left:1em' }, [ autoChk, ' ', _('Auto refresh (5s)') ])
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Frontend Session Log')),
				frontBox
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Backend Log (device)'), ' ', backendPath ]),
				backendPre
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
