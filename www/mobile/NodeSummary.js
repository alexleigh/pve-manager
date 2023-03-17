Ext.define('PVE.NodeInfo', {
    extend: 'Ext.Component',
    alias: 'widget.pveNodeInfo',

    config: {
	style: 'background-color: white;',
	styleHtmlContent: true,
	data: [],
	tpl: [
	    '<table style="margin-bottom:0px;">',
	    '<tr><td>Version:</td><td>{pveversion}</td></tr>',
	    '<tr><td>Memory:</td><td>{[this.meminfo(values)]}</td></tr>',
	    '<tr><td>CPU:</td><td>{[this.cpuinfo(values)]}</td></tr>',
	    '<tr><td>Uptime:</td><td>{[Proxmox.Utils.format_duration_long(values.uptime)]}</td></tr>',
	    '<tr><td>CPU temp:</td><td>{[this.cputemp(values)]}</td></tr>',
	    '<tr><td>HD1 temp:</td><td>{[this.hd1temp(values)]}</td></tr>',
	    '<tr><td>HD2 temp:</td><td>{[this.hd2temp(values)]}</td></tr>',
	    '<tr><td>HD3 temp:</td><td>{[this.hd3temp(values)]}</td></tr>',
	    '</table>',
	    {
		meminfo: function(values) {
		    var d = values.memory;
		    if (!d) {
			return '-';
		    }
		    return Proxmox.Utils.format_size(d.used || 0) + " of " + Proxmox.Utils.format_size(d.total);
		},
		cpuinfo: function(values) {
		    if (!values.cpuinfo) {
			return '-';
		    }
		    var per = values.cpu * 100;
		    return per.toFixed(2) + "% (" + values.cpuinfo.cpus + " CPUs)";
		},
		rendertemp: function(temp) {
			if (!temp) {
				return '-';
			}
			return temp.used + '°C (crit: ' + temp.total + '°C)';
		},
		cputemp: function(values) { return this.rendertemp(values.cputemp); },
		hd1temp: function(values) { return this.rendertemp(values.hd1temp); },
		hd2temp: function(values) { return this.rendertemp(values.hd2temp); },
		hd3temp: function(values) { return this.rendertemp(values.hd3temp); }
	    }
	]
    },
});

Ext.define('PVE.NodeSummary', {
    extend: 'PVE.Page',
    alias: 'widget.pveNodeSummary',

    statics: {
	pathMatch: function(loc) {
	    return loc.match(/^nodes\/([^\s\/]+)$/);
	}
    },

    nodename: undefined,

    config: {
	items: [
	    { 
		xtype: 'pveTitleBar'
	    },
	    {
		xtype: 'pveNodeInfo'
	    },
            {
                xtype: 'component',
                cls: 'dark',
		padding: 5,
 		html: gettext('Virtual machines')
            },
	    {
		xtype: 'list',
		flex: 1,
		disableSelection: true,
		listeners: {
		    itemsingletap: function(list, index, target, record) {
			PVE.Workspace.gotoPage('nodes/' + record.get('nodename') + '/' + 
					       record.get('type') + '/' + record.get('vmid'));
		    } 
		},
		grouped: true,
		itemTpl: [
		    '{name}<br>',
		    '<small>',
		    'id: {vmid} ',
		    '<tpl if="uptime">',
		    'cpu: {[this.cpuinfo(values)]} ',
		    'mem: {[this.meminfo(values)]} ',
		    '</tpl>',
		    '</small>',
		    {
			meminfo: function(values) {
			    if (!values.uptime) {
				return '-';
			    }
			    return Proxmox.Utils.format_size(values.mem);
			},
			cpuinfo: function(values) {
			    if (!values.uptime) {
				return '-';
			    }
			    return (values.cpu*100).toFixed(1) + '%';
			}
		    }
		]
	    }
	]
    },

    reload: function() {
 	var me = this;

	var ni = me.down('pveNodeInfo');

	Proxmox.Utils.API2Request({
	    url: '/nodes/' + me.nodename + '/status',
	    method: 'GET',
	    success: function(response) {
		var d = response.result.data;
		if (d.pveversion) {
		    d.pveversion = d.pveversion.replace(/pve\-manager\//, '');
		}
		ni.setData(d);
	    }
	});


	var list = me.down('list');

	list.setMasked(false);

	var error_handler = function(response) {
	    list.setMasked({ xtype: 'loadmask', message: response.htmlStatus} );
	};

	Proxmox.Utils.API2Request({
	    url: '/nodes/' + me.nodename + '/lxc',
	    method: 'GET',
	    success: function(response) {
		var d = response.result.data;
		d.nodename = me.nodename;
		d.forEach(function(el) { el.type = 'lxc'; el.nodename = me.nodename });
		me.store.each(function(rec) {
		    if (rec.get('type') === 'lxc') {
			rec.destroy();
		    }
		});
		me.store.add(d);
	    },
	    failure: error_handler
	});

	Proxmox.Utils.API2Request({
	    url: '/nodes/' + me.nodename + '/qemu',
	    method: 'GET',
	    success: function(response) {
		var d = response.result.data;
		d.forEach(function(el) { el.type = 'qemu'; el.nodename = me.nodename });
		me.store.each(function(rec) {
		    if (rec.get('type') === 'qemu') {
			rec.destroy();
		    }
		});
		me.store.add(d);
	    },
	    failure: error_handler
	});

    },

	autoRefreshTask: null,
	setMenuItems: function() {
	var me = this;
	if (me.autoRefreshTask === null) {
		var refreshButton = {
			text: gettext('Enable Auto-refresh'),
			handler: function() {
				me.autoRefreshTask = setInterval(function() { me.reload(); }, 3000);
				me.setMenuItems();
			}
		}
	} else {
		var refreshButton = {
			text: gettext('Disable Auto-refresh'),
			handler: function() {
				clearInterval(me.autoRefreshTask);
				me.autoRefreshTask = null;
				me.setMenuItems();
			}
		}
	};

	me.down('pveMenuButton').setMenuItems([
		{
		text: gettext('Tasks'),
		handler: function() {
			PVE.Workspace.gotoPage('nodes/' + me.nodename + '/tasks');
		}
		},
		refreshButton
	]);
	},

    initialize: function() {
	var me = this;

	var match = me.self.pathMatch(me.getAppUrl());
	if (!match) {
	    throw "pathMatch failed";
	}

	me.nodename = match[1];

	me.down('titlebar').setTitle(gettext('Node') + ': ' + me.nodename);

	me.setMenuItems();

	me.store = Ext.create('Ext.data.Store', {
	    fields: [ 'name', 'vmid', 'nodename', 'type', 'memory', 'uptime', 'mem', 'maxmem', 'cpu', 'cpus'],
	    sorters: ['vmid'],
	    grouper: {
		groupFn: function(record) {
		    return record.get('type');
		}
	    },
	});

	var list = me.down('list');
	list.setStore(me.store);

	me.reload();

	this.callParent();
    }
});
