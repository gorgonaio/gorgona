# Gorgona.io smart contract

[Gorgona io](https://gorgona.io)


### Check contract working


**Before you start, you need to install required packages.**

```
$ npm install ganache-cli truffle -g
$ npm install
```

**Launch private blockchain using ganache.**

`$ ganache-cli`

**Testing**

First of all, to ensure that everything works properly you should run tests.

`$ truffle test test/gorgona.io`

If everything was great you will see smth like this:
```
Compiling ./contracts/Gorgona.sol...

  Contract: Gorgona
    ✓ has an owner
    ✓ Contract can accepts funds (188ms)
    ✓ Reinvest is considered correctly (113ms)
    ✓ Owner fee (238ms)
    ✓ Payments: there should be no payments immediately after the investment (48ms)
    ✓ Referrer commission works properly (554ms)
    ✓ Referrer: incorrectly specified referrer has no effect (346ms)
    ✓ Referrer: cashback works properly (527ms)
    ✓ Check minimum invest
    ✓ Check working admin function to change min payout interval (203ms)
    ✓ Payouts: check function getInvestorUnPaidAmount (102ms)
    ✓ Payouts: check function payoutSelf (526ms)
    ✓ Check getDepositAmount & getInvestorCount functions (106ms)
    ✓ Payout: checks payouts work properly (760ms)


  14 passing (5s)
```

To ensure that smart-contact can be used by tones of investors,
you should run `load-test.js

Before testing you should start ganache-cli with key `-a 500`  (investors count).

`$ ganache-cli -a 500`


Warning! This test took a lot of time!

`$ truffle test test/gorgona-loadtest.io`


If everything was great you will see smth like this:
```Compiling ./contracts/Gorgona.sol...


  Contract: Gorgona
    ✓ Loadtesting: Create a many investors (6476ms)
    ✓ Loadtesting: Check payout for a large number of investors (29773ms)


  2 passing (36s)

```