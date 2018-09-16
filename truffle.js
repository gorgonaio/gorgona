require('babel-register');
require('babel-polyfill');


module.exports = {
	networks: {
		development: {
			host: "localhost",
			port: 8545,
			network_id: "*",
			gasLimit: 6e6,
			gasPrice: 5e9
		}
	}
};
