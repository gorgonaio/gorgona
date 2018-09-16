const Gorgona = artifacts.require('./Gorgona.sol');
const time = require("./helper/increaseTime");

contract('Gorgona', function (accounts) {
	let gorgona;

	beforeEach('setup contract for each test', async function () {
		gorgona = await Gorgona.new();
	});

	it('Loadtesting: Create a many investors', async function () {
		let amount = 1e+18;

		for (let i = 1; i <= accounts.length - 1; i++) {
			let account = accounts[i];
			await gorgona.sendTransaction({value: amount, from: account});
			let investor = await gorgona.investors(account);

			assert.equal(investor[1].toNumber(), amount, 'Account must have 1 eth balance');
		}

		let gorgonaAddress = await gorgona.address;
		let gorgonaBalance = await web3.eth.getBalance(gorgonaAddress).toNumber();
		assert.equal(gorgonaBalance, amount * 0.03 + ((accounts.length - 1) * amount * 0.77), "Gorgona balance incorrect");
	});

	it('Loadtesting: Check payout for a large number of investors', async function () {
		let amount = 1e+18;
		let part = Math.floor(amount * 0.03);

		let balances = {};

		for (let i = 1; i <= accounts.length - 1; i++) {
			await gorgona.sendTransaction({value: amount, from: accounts[i]});

			balances[accounts[i]] = await web3.eth.getBalance(accounts[i]).toNumber();
		}
		await time.increaseTime(time.duration.hours(24));
		await gorgona.payout(0)
			.then(async function (tx) {
				assert.equal(tx.receipt.status, '0x1', 'tx status error');
			})
			.catch((err) => {
				assert(false, err.toString());
			});


		for (let i = 1; i <= accounts.length - 1; i++) {
			let balance = await web3.eth.getBalance(accounts[i]);

			assert.isAtLeast(balance.toNumber(), balances[accounts[i]] + part, "Addr " + accounts[i] + " have incorrect balance");
		}
	});


	it('Loadtesting: Check next round on a lot investors', async function () {
		let amount = 1e+18;

		for (let i = 1; i <= accounts.length - 1; i++) {
			await gorgona.sendTransaction({value: amount, from: accounts[i]});
		}

		await time.increaseTime(time.duration.days(900000));

		let currentRound = await gorgona.round();

		let max = await gorgona.MASS_TRANSACTION_LIMIT();

		for (let i = 0; i <= Math.ceil(accounts.length / max); i++) {
			await gorgona.payout(0)
				.then(async function (tx) {
					assert.equal(tx.receipt.status, '0x1', 'tx status error');
				});
		}

		let round = await gorgona.round();
		assert.equal(round.toNumber(), currentRound.toNumber() + 1, 'incorrect round');

		for (let i = 1; i <= accounts.length - 1; i++) {
			let investor = await gorgona.investors(accounts[i]);
			assert.equal(investor[1].toNumber(), 0, 'incorrect balance');
		}
	});

});