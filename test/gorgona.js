const time = require("./helper/increaseTime");

const Gorgona = artifacts.require('./Gorgona.sol');
const Theft = artifacts.require('./Theft.sol');


contract('Gorgona', function ([owner, donor, donor2, donor3, donor4, donor5]) {
	let gorgona;

	beforeEach('Setup contract', async function () {
		gorgona = await Gorgona.new();
	});

	it('Has an owner', async function () {
	    assert.equal(await gorgona.owner(), owner)
	});


	it('Contract can accept incoming transactions', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});

		const gorgonaAddress = await gorgona.address;
		assert.equal(web3.eth.getBalance(gorgonaAddress).toNumber(), amount - amount / 5);

		let investor = await gorgona.investors(donor);
		assert.equal(investor[1].toNumber(), amount);
	});

	it('Reinvest is correct', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor});
		let invested = await gorgona.investors(donor);

		assert.equal(invested[1].toNumber(), amount);
		await gorgona.sendTransaction({value: amount * 2, from: donor});

		let investor = await gorgona.investors(donor);
		assert.equal(investor[1].toNumber(), amount + (amount * 2));
	});

	it('Owner receives correct fee', async function () {
		let amount = 1e+18;
		let balance = web3.eth.getBalance(owner);

		await gorgona.sendTransaction({value: amount, from: donor});

		let newBalance = web3.eth.getBalance(owner);

		assert.equal(balance.toNumber() + amount / 5, newBalance);
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

	it('Referrer: cash-back works properly', async function () {
	    let amount = 1e+18;
	    await gorgona.sendTransaction({value: amount, from: donor});
	    let userBalanceBefore = web3.eth.getBalance(donor2);
	    await gorgona.sendTransaction({value: amount, from: donor2, data: donor}).then(async function (tx) {
	        let transaction = await web3.eth.getTransaction(tx.tx);
	        let gasPrice = transaction.gasPrice;
	        let expected = userBalanceBefore
	                .minus(amount)
	                .plus((web3.toBigNumber(amount)).mul(3).div(100))
	                .minus(gasPrice.mul(tx.receipt.gasUsed));

	        assert.equal(web3.eth.getBalance(donor2).toNumber(), expected.toNumber(), 'The first deposit must be cashback');
	    });

	    userBalanceBefore = web3.eth.getBalance(donor2);
	    await gorgona.sendTransaction({value: amount, from: donor2}).then(async function (tx) {

	        let transaction = await web3.eth.getTransaction(tx.tx);
	        let gasPrice = transaction.gasPrice;
	        let expected = userBalanceBefore.minus(amount).minus(gasPrice.mul(tx.receipt.gasUsed));

	        assert.equal(web3.eth.getBalance(donor2).toNumber(), expected.toNumber(), 'The second time there should not be a cashback');
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

	it('Payout: check function getInvestorDividendsAmount', async function () {
		let amount = 1e+18;
		await gorgona.sendTransaction({value: amount, from: donor4});
		await time.increaseTime(time.duration.hours(12));
		let unpaid = await gorgona.getInvestorDividendsAmount(donor4);

		assert.isAtLeast(unpaid.toNumber(), (amount * 0.03) / 2, "Unpaid incorrect");
	});

	it('Payout: check function self payout', async function () {
		let amount = 1e+18;
		let myDonor = donor5;

		await gorgona.sendTransaction({value: amount, from: myDonor});
		await time.increaseTime(time.duration.hours(24));
		let donorAmountBefore = web3.eth.getBalance(myDonor).toNumber();

		let gorgonaBalance = web3.eth.getBalance(gorgona.address).toNumber();
		await gorgona.sendTransaction({value: 0, from: myDonor})
			.then(async function (tx) {
				let unpaid = (amount * 0.03) / 2;
				// gas price
				let gasPrice = (tx.receipt.gasUsed * 100000000000) * 10;

				assert.isAtLeast(
					Math.round(web3.fromWei(web3.eth.getBalance(myDonor).toNumber(), 'szabo')),
					Math.round(web3.fromWei(donorAmountBefore + unpaid - gasPrice, 'szabo')),
					"Donor balance incorrect"
				);
				assert.isAtMost(web3.eth.getBalance(gorgona.address).toNumber(), gorgonaBalance - unpaid, "Contract balance incorrect");

				let investor = await gorgona.investors(myDonor);
				assert.isAtLeast(investor[3].toNumber(), time.duration.hours(24) + Math.floor((new Date).getTime() / 1000), "Date incorrect");

				await gorgona.sendTransaction({value: 0, from: myDonor})
					.catch((err) => {
						assert.include(err.toString(), 'Dividends required too early', 'payout request error');
					});
			});
	});

	it('Check getDepositAmount & getInvestorCount functions', async function () {
		let amount = 1e+18;

		let depositAmountBefore = await gorgona.depositAmount();
		let investorCountBefore = await gorgona.getInvestorCount();

		await gorgona.sendTransaction({value: amount, from: donor3});

		let depositAmount = await gorgona.depositAmount();
		let investorCount = await gorgona.getInvestorCount();

		assert.equal(depositAmount.toNumber(), depositAmountBefore.toNumber() + amount, 'Total deposit amount incorrect');
		assert.equal(investorCount.toNumber(), investorCountBefore.toNumber() + 1, 'Total investors count incorrect');
	});

	it('Payout: check payouts work properly', async function () {
		let amount = 1e+18;
		let part = Math.floor(amount * 0.03);
		await gorgona.sendTransaction({value: amount, from: donor});
		let date = Math.floor(new Date().getTime() / 1000) - 60 * 60 * 24;

		await time.increaseTime(time.duration.hours(24));

		let donorAmountBefore = web3.eth.getBalance(donor).toNumber();
		let gorgonaBalance = web3.eth.getBalance(gorgona.address).toNumber();

		await gorgona.payout(0, {from: owner})
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

		await time.increaseTime(time.duration.hours(1));
		gorgonaBalance = web3.eth.getBalance(gorgona.address);
		await gorgona
			.payout(0)
			.then(() => {
				assert.equal(
					web3.eth.getBalance(gorgona.address).toNumber(),
					gorgonaBalance.toNumber(),
					"Contract balance should not change");
			});
	});


	it('Check ownershipTransfer', async function () {
		await gorgona.transferOwnership(0x0);

		let newOwner = await gorgona.owner();
		assert.equal(newOwner, 0x0, 'owner error');


		let ownerBalanceBefore = await web3.eth.getBalance(owner);
		await gorgona.sendTransaction({value: 1e18, from: donor});

		let ownerBalance = await web3.eth.getBalance(owner);


		assert.equal(ownerBalance.toNumber(), ownerBalanceBefore.toNumber() + 1e18 * 0.2, 'Owner balance error');
	});



	it('Check revert on another contract', async function () {
		let theft = await Theft.new();

		let addr = await theft.address;

		await theft.addMoney(1, {value: 1e18});
		await theft.payTo(await gorgona.address, 0.5e18, 6e6);
		assert.equal(web3.eth.getBalance(addr).toNumber(), 1e18, "Theft contract balance should not change");

		let investor = await gorgona.investors(addr);
		assert.equal(investor[1].toNumber(), 0, "Theft investor incorrect");
	});

	it('Check KOtH: GorgonaKiller', async function () {
		let amount = 1e18;
		await gorgona.sendTransaction({value: amount, from: donor2});

		let killer = await gorgona.gorgonaKiller();
		assert.equal(killer[0], donor2, 'Gorgona killer incorrect');

		await gorgona.sendTransaction({value: amount * 2, from: donor});

		killer = await gorgona.gorgonaKiller();
		assert.equal(killer[0], donor, 'Gorgona killer incorrect');

		let donorBalanceBefore = await web3.eth.getBalance(donor);

		await gorgona.sendTransaction({value: amount, from: donor3});

		let donorBalance = await web3.eth.getBalance(donor	);

		assert.equal(donorBalance.toNumber(), donorBalanceBefore.toNumber() + (amount * 0.03), 'no GorgonaKiller bonus');
	});

	it('Check rounds', async function () {
		let currentRound = await gorgona.round();
		let amount = 1e18;
		let donors = [donor, donor2, donor3];

		for (let i = 0; i <= donors.length - 1; i++) {
			let value = donors[i];

			await gorgona.sendTransaction({value: amount, from: value});
			let investor = await gorgona.investors(value);
			assert.equal(investor[1].toNumber(), amount, 'incorrect depo amount');
		}

		await time.increaseTime(time.duration.days(365));
		await gorgona.sendTransaction({value: 1e18, from: donor});
		await gorgona.sendTransaction({value: 1e18, from: donor}).catch(function(err) {
			assert.include(err.toString(), 'Gorgona is restarting', 'restart error');
		});

		await gorgona.payout(0);

		let round = await gorgona.round();
		assert.equal(round.toNumber(), currentRound.toNumber() + 1, 'incorrect round');

		await donors.forEach(async function (value) {
			let investor = await gorgona.investors(value);
			assert.equal(investor[1].toNumber(), 0, 'incorrect balance');
		});

		let depoAmount = await gorgona.depositAmount();
		assert.equal(depoAmount.toNumber(), 0, 'incorrect depo amount');

		let inverstorCount = await gorgona.getInvestorCount();
		assert.equal(inverstorCount.toNumber(), 0, 'incorrect investor count');
	});

});