pragma solidity ^0.4.0;

contract Theft {

    bool revertSelf;

    function addMoney(uint num) public payable
    {
        num = 0;

        return;
    }

    function() payable public
    {
        revert();
    }

    function payTo(address addr, uint amount, uint gas) public {
        if (addr.call.value(amount).gas(gas)()) {

        }
    }

    function enableRevert() public
    {
        revertSelf = true;
    }
}