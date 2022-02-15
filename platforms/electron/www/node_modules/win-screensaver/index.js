'use strict';
var Promise = require('pinkie-promise');
var nircmd = require('nircmd');

module.exports = function () {
	if (process.platform !== 'win32') {
		return Promise.reject(new Error('Only Windows systems are supported'));
	}

	return nircmd('screensaver');
};
