const Gorgona = artifacts.require('./Gorgona.sol');

contract('Gorgona', function (accounts) {
	let gorgona;

	beforeEach('setup contract for each test', async function () {
		gorgona = await Gorgona.new();
	});


	it('Loadtesting: Create a many investors', async function () {
		let amount = 1e+18;
		let part = Math.floor(amount * 0.03);

		for (let i = 0; i <= accounts.length - 1; i++) {
			let account = accounts[i];
			await gorgona.sendTransaction({value: amount, from: account});
			let balance = await gorgona.getInvestorDeposit(account);

			assert.equal(balance.toNumber(), amount, 'Account must have 1 eth balance');
		}

		let gorgonaAddress = await gorgona.address;
		let gorgonaBalance = await web3.eth.getBalance(gorgonaAddress).toNumber();
		assert.equal(gorgonaBalance, accounts.length * amount * 0.8, "Gorgona balance incorrect");
	});


	it('Loadtesting: Check payout for a large number of investors', async function () {
		let amount = 1e+18;
		let part = Math.floor(amount * 0.03);

		let date = Math.floor(new Date().getTime() / 1000) - (60 * 60 * 24) - 1;
		let balances = {};

		for (let i = 1; i <= accounts.length - 1; i++) {
			await gorgona.sendTransaction({value: amount, from: accounts[i]});
			await gorgona.setDatePayout(accounts[i], date);

			balances[accounts[i]] = await web3.eth.getBalance(accounts[i]).toNumber();
		}
		gorgona.setPayoutCumulativeInterval(0);

		let num = 50;

		for(let i = 0; i <= Math.ceil(accounts.length / num); i++) {
			await gorgona.payout(num)
				.then(function (tx) {
					assert.equal(tx.receipt.status, '0x1', 'tx status error');
					gorgona.setPayoutCumulativeInterval(0);
				})
				.catch((err) => {
					assert(false, err.toString());
				});
		}

		for (let i = 1; i <= accounts.length - 1; i++) {
			let balance = await web3.eth.getBalance(accounts[i]);

			assert.isAtLeast(balance.toNumber(), balances[accounts[i]] + part, "Addr " + accounts[i] + " have incorrect balance");
		}
	});

});