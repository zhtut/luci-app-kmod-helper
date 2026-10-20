'use strict';
'require view';
'require rpc';

/* Easy Setup entry view: loads the UI kit, the tab modules and the current
   config, then renders the tab bar. Adding a feature later = drop a new
   tab.<id>.js next to the others and add one L.require line + registry
   entry below; nothing else changes. */

var callGetCurrent = rpc.declare({
	object: 'luci.easy-setup',
	method: 'get_current',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			L.require('easy-setup/ui'),
			L.require('view/easy-setup/tab.basic'),
			L.require('view/easy-setup/tab.password'),
			L.require('view/easy-setup/tab.lanip'),
			L.require('view/easy-setup/tab.wifi'),
			L.require('view/easy-setup/tab.mode'),
			callGetCurrent().catch(function() { return {}; })
		]).then(function(res) {
			return { ES: res[0], tabs: res.slice(1, 6), current: res[6] || {} };
		});
	},

	render: function(data) {
		var ES = data.ES;
		var tabs = data.tabs;
		var current = data.current;

		var bar = E('div', { 'class': 'es-tabs' });
		var content = E('div', {});
		var shown = -1;

		function show(i) {
			if (i === shown) return;
			shown = i;
			Array.prototype.forEach.call(bar.children, function(b, j) {
				if (j === i) b.classList.add('active');
				else b.classList.remove('active');
			});
			content.textContent = '';
			tabs[i].render(content, current, ES);
		}

		tabs.forEach(function(tab, i) {
			bar.appendChild(E('button', {
				'class': 'es-tab',
				'type': 'button',
				'click': function() { show(i); }
			}, _(tab.title)));
		});

		show(0);

		return E('div', {}, [
			E('h2', {}, _('Easy Setup')),
			E('div', { 'class': 'cbi-section-descr' },
				_('Every change on this page applies immediately when you click Save — there is no separate "apply" step and nothing to confirm.')),
			bar,
			content
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
