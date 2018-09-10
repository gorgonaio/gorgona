const Gorgona = artifacts.require('./Gorgona.sol');

contract('Gorgona', function ([owner, donor, donor2, donor3, donor4, donor5]) {
	let gorgona;

	beforeEach('setup contract for each test', async function () {
		gorgona = await Gorgona.new();
	});

	it('has an owner', async function () {
		assert.equal(await gorgona.owner(), owner)
	});

	it('Contract can accepts funds', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});

		const gorgonaAddress = await gorgona.address;
		assert.equal(web3.eth.getBalance(gorgonaAddress).toNumber(), amount - amount / 5);

		let invested = await gorgona.getInvestorDeposit.call(donor);
		assert.equal(invested.toNumber(), amount);
	});

	it('Reinvest is considered correctly', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});
		let invested = await gorgona.getInvestorDeposit.call(donor);

		assert.equal(invested.toNumber(), amount);
		await gorgona.sendTransaction({value: amount * 2, from: donor});

		invested = await gorgona.getInvestorDeposit.call(donor);
		assert.equal(invested.toNumber(), amount + (amount * 2));
	});

	it('Owner fee', async function () {
		let amount = 1e+18;
		let balance = web3.eth.getBalance(owner);

		await gorgona.sendTransaction({value: amount, from: donor});

		let newBalance = web3.eth.getBalance(owner);

		assert.equal(balance.toNumber() + amount / 5, newBalance);
	});

	it('Payments: there should be no payments immediately after the investment', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});

		gorgona.payout(10)
			.then((tx) => {
				assert(false, "no payouts");
			})
			.catch((err) => {
				assert.include(err.toString(), 'revert', 'No time validation');
			});
	});

	it('Referrer commission works properly', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});

		let refAmountBefore = web3.eth.getBalance(donor).toNumber();
		await gorgona.sendTransaction({value: amount, from: donor2, data: donor});

		assert.equal(web3.eth.getBalance(donor).toNumber(), refAmountBefore + amount * 0.03);

		refAmountBefore = web3.eth.getBalance(donor).toNumber();
		await gorgona.sendTransaction({value: amount, from: donor2});

		assert.equal(web3.eth.getBalance(donor).toNumber(), refAmountBefore + amount * 0.03);
	});

	it('Referrer: incorrectly specified referrer has no effect', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor, data: 'some data'})
			.then((tx) => {
				assert.equal(tx.receipt.status, '0x1', 'Tx status error');
			});

		let balanceBefore = web3.eth.getBalance(donor2).toNumber();
		await gorgona.sendTransaction({value: amount, from: donor, data: donor2})
			.then((tx) => {
				assert.equal(tx.receipt.status, '0x1', 'tx (2) status erro');

				let balance = web3.eth.getBalance(donor2).toNumber();

				assert.equal(balanceBefore, balance, 'Fake ref balance error');
			})
		;

		await gorgona.sendTransaction({value: amount, from: donor, data: '0x0000000000000000000000000000000000000000'})
			.then((tx) => {
				assert.equal(tx.receipt.status, '0x1', 'tx (2) status error');
			})
		;
	});

	it('Referrer: cashback works properly', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});

		let userBalanceBefore = web3.eth.getBalance(donor2).toNumber();
		await gorgona.sendTransaction({value: amount, from: donor2, data: donor}).then(function (tx) {
			// check cashback for first deposit
			let expected = (userBalanceBefore - amount) + (amount * 0.03);
			expected -= (tx.receipt.gasUsed * 100000000000) * 10;
			assert.isAtLeast(web3.eth.getBalance(donor2).toNumber(), expected, 'The first deposit must be cashback');
		});

		userBalanceBefore = web3.eth.getBalance(donor2).toNumber();
		await gorgona.sendTransaction({value: amount, from: donor2}).then((tx) => {
			let expected = userBalanceBefore - amount;
			expected -= tx.receipt.gasUsed * 100000000000;
			assert.isAtMost(web3.eth.getBalance(donor2).toNumber(), expected, 'The second time there should not be a cashback');
		});

	});

	it('Check minimum invest', async function () {
		let amount = 1e+10;
		await gorgona.sendTransaction({value: amount, from: donor})
			.then(() => {
				assert(false, 'The contract should not take too low deposit');
			})
			.catch((err) => {
				assert.include(err.toString(), 'Too small amount', 'No minimum invest checks');
			});
	});

	it('Check working admin function to change min payout interval', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});
		let date = Math.floor(new Date().getTime() / 1000) - 60 * 60 * 24;

		await gorgona.setDatePayout(donor, date);
		let dt = await gorgona.getInvestorDatePayout(donor);
		assert.equal(dt.toNumber(), date, "Last payment date incorrect");

		await gorgona.setPayoutCumulativeInterval(0);
		let minInterval = await gorgona.getPayoutCumulativeInterval();
		assert.equal(minInterval.toNumber(), 0, "Min interval incorrect");
	});

	it('Payouts: check function getInvestorUnPaidAmount', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor4});
		let date = Math.floor(new Date().getTime() / 1000) - 60 * 60 * 12; // 12 hours

		await gorgona.setDatePayout(donor4, date);
		let unpaid = await gorgona.getInvestorUnPaidAmount(donor4);

		assert.isAtLeast(unpaid.toNumber(), (amount * 0.03) / 2, "Unpaid incorrect");
	});

	it('Payouts: check function payoutSelf	', async function () {
		let amount = 1e+18;
		let myDonor = donor5;

		await gorgona.sendTransaction({value: amount, from: myDonor});
		let date = Math.floor(new Date().getTime() / 1000) - 60 * 60 * 12; // 12 hours
		await gorgona.setDatePayout(myDonor, date);
		let donorAmountBefore = web3.eth.getBalance(myDonor).toNumber();

		let gorgonaBalance = web3.eth.getBalance(gorgona.address).toNumber();
		await gorgona.payoutSelf(myDonor, {from: myDonor})
			.then(function (tx) {
				let unpaid = (amount * 0.03) / 2;
				// заложим цену газу до 10 раз выше, главное чтобы основное тело выплаты пришло
				let gasPrice = (tx.receipt.gasUsed * 100000000000) * 10;

				assert.isAtLeast(
					Math.round(web3.fromWei(web3.eth.getBalance(myDonor).toNumber(), 'szabo')),
					Math.round(web3.fromWei(donorAmountBefore + unpaid - gasPrice, 'szabo')),
					"Donor balance incorrect"
				);
				assert.isAtMost(web3.eth.getBalance(gorgona.address).toNumber(), gorgonaBalance - unpaid, "Contract balance incorrect");
			});

		let remoteDate = await gorgona.getInvestorDatePayout(myDonor);
		assert.isAtLeast(Math.floor((new Date).getTime() / 1000), remoteDate.toNumber(), "Date incorrect");

		await gorgona.payoutSelf(myDonor, {from: myDonor})
			.catch((err) => {
				assert.include(err.toString(), 'too fast payment required', 'payout request error');
			});
	});

	it('Check getDepositAmount & getInvestorCount functions', async function () {
		let amount = 1e+18;

		let investorCountBefore = await gorgona.getInvestorCount();
		let depositAmountBefore = await gorgona.getDepositAmount();

		await gorgona.sendTransaction({value: amount, from: donor3});

		let depositAmount = await gorgona.getDepositAmount();
		let investorCount = await gorgona.getInvestorCount();

		assert.equal(depositAmount.toNumber(), depositAmountBefore.toNumber() + amount, 'Total deposit amount incorrect');
		assert.equal(investorCount.toNumber(), investorCountBefore.toNumber() + 1, 'Total investors count incorrect');
	});

	it('Payout: checks payouts work properly', async function () {
		let amount = 1e+18;
		let part = Math.floor(amount * 0.03);
		await gorgona.sendTransaction({value: amount, from: donor});
		let date = Math.floor(new Date().getTime() / 1000) - 60 * 60 * 24;

		await gorgona.setDatePayout(donor, date);
		await gorgona.setPayoutCumulativeInterval(0);

		let donorAmountBefore = web3.eth.getBalance(donor).toNumber();
		let gorgonaBalance = web3.eth.getBalance(gorgona.address).toNumber();

		await gorgona.payout(100, {from: owner})
			.then(function (tx) {
				assert.isAtLeast(
					web3.eth.getBalance(donor).toNumber(),
					donorAmountBefore + part,
					"Donor balance incorrect"
				);

				assert.isAtMost(
					web3.eth.getBalance(gorgona.address).toNumber(),
					gorgonaBalance - part,
					"Contract balance incorrect"
				);
			});

		gorgonaBalance = web3.eth.getBalance(gorgona.address);
		await gorgona
			.payout(1)
			.then(() => {
				assert.equal(
					web3.eth.getBalance(gorgona.address).toNumber(),
					gorgonaBalance.toNumber(),
					"Contract balance should not change");
			});
	});

});