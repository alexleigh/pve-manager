package PVE::API2::Hardware::PCI;

use strict;
use warnings;

use PVE::JSONSchema qw(get_standard_option);

use PVE::RESTHandler;
use PVE::SysFSTools;

use base qw(PVE::RESTHandler);

my $default_class_blacklist = "05;06;0b";

__PACKAGE__->register_method ({
    name => 'pciscan',
    path => '',
    method => 'GET',
    description => "List local PCI devices.",
    protected => 1,
    proxyto => "node",
    permissions => {
	check => ['perm', '/', ['Sys.Audit', 'Sys.Modify'], any => 1],
    },
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	    'pci-class-blacklist' => {
		type => 'string',
		format => 'string-list',
		default => $default_class_blacklist,
		optional => 1,
		description => "A list of blacklisted PCI classes, which will ".
			       "not be returned. Following are filtered by ".
			       "default: Memory Controller (05), Bridge (06) and ".
			       "Processor (0b).",
	    },
	    verbose => {
		type => 'boolean',
		default => 1,
		optional => 1,
		description => "If disabled, does only print the PCI IDs. "
			      ."Otherwise, additional information like vendor "
			      ."and device will be returned.",
	    },
	},
    },
    returns => {
	links => [ { rel => 'child', href => "{id}" } ],
	type => 'array',
	items => {
	    type => "object",
	    properties => {
		id => {
		    type => 'string',
		    description => "The PCI ID.",
		},
		class => {
		    type => 'string',
		    description => 'The PCI Class of the device.',
		},
		vendor => {
		    type => 'string',
		    description => 'The Vendor ID.',
		},
		vendor_name => {
		    type => 'string',
		    optional => 1,
		},
		device => {
		    type => 'string',
		    description => 'The Device ID.',
		},
		device_name => {
		    type => 'string',
		    optional => 1,
		},
		subsystem_vendor => {
		    type => 'string',
		    description => 'The Subsystem Vendor ID.',
		    optional => 1,
		},
		subsystem_vendor_name => {
		    type => 'string',
		    optional => 1,
		},
		subsystem_device => {
		    type => 'string',
		    description => 'The Subsystem Device ID.',
		    optional => 1,
		},
		subsystem_device_name => {
		    type => 'string',
		    optional => 1,
		},
		iommugroup => {
		    type => 'integer',
		    description => "The IOMMU group in which the device is in.".
				   " If no IOMMU group is detected, it is set to -1.",
		},
		mdev => {
		    type => 'boolean',
		    optional => 1,
		    description => "If set, marks that the device is capable "
				  ."of creating mediated devices.",
		}
	    },
	},
    },
    code => sub {
	my ($param) = @_;

	my $blacklist = $param->{'pci-class-blacklist'} // $default_class_blacklist;
	my $class_regex = join('|', PVE::Tools::split_list($blacklist));

	my $filter;

	if ($class_regex ne '') {
	    $filter =  sub {
		my ($pcidevice) = @_;

		if ($pcidevice->{class} =~ m/^0x(?:$class_regex)/) {
		    return 0;
		}

		return 1;
	    };
	}

	my $verbose = $param->{verbose} // 1;

	return PVE::SysFSTools::lspci($filter, $verbose);
    }});

__PACKAGE__->register_method ({
    name => 'pciindex',
    path => '{pciid}',
    method => 'GET',
    description => "Index of available pci methods",
    permissions => {
	user => 'all',
    },
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	    pciid => {
		type => 'string',
		pattern => '(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F]',
	    },
	},
    },
    returns => {
	type => 'array',
	items => {
	    type => "object",
	    properties => { method => { type => 'string'} },
	},
	links => [ { rel => 'child', href => "{method}" } ],
    },
    code => sub {
	my ($param) = @_;

	my $res = [
	    { method => 'mdev' },
	];

	return $res;
    }});

__PACKAGE__->register_method ({
    name => 'mdevscan',
    path => '{pciid}/mdev',
    method => 'GET',
    description => "List mediated device types for given PCI device.",
    protected => 1,
    proxyto => "node",
    permissions => {
	check => ['perm', '/', ['Sys.Audit', 'Sys.Modify'], any => 1],
    },
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	    pciid => {
		type => 'string',
		pattern => '(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F]',
		description => "The PCI ID to list the mdev types for."
	    },
	},
    },
    returns => {
	type => 'array',
	items => {
	    type => "object",
	    properties => {
		type => {
		    type => 'string',
		    description => "The name of the mdev type.",
		},
		available => {
		    type => 'integer',
		    description => "The number of still available instances of"
				  ." this type.",
		},
		description => {
		    type => 'string',
		},
	    },
	},
    },
    code => sub {
	my ($param) = @_;

	return PVE::SysFSTools::get_mdev_types($param->{pciid});
    }});
