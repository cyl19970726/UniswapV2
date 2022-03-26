//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IERC20.sol"; 
import "./interfaces/IUniswapV2Callee.sol";
import "./UniswapV2ERC20.sol"; 
import "./libraries/UQ112x112.sol";
import "./libraries/Math.sol";

contract UniswapV2Pair is IUniswapV2Pair , UniswapV2ERC20 {
    // 0.8.0 不需要SafeMath 编译器会检查溢出
    // using SafeMath  for uint;

     using UQ112x112 for uint224;

    uint public constant override MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes("transfer(address,uint256)")));

    address public override factory;
    address public override token0;
    address public override token1;

    // reserve0 代表token0数量 reserve1代表token1数量
    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves
    uint32  private blockTimestampLast; // uses single storage slot, accessible via getReserves

    uint public override price0CumulativeLast;
    uint public override price1CumulativeLast;
    uint public override kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    // bytes32 public override DOMAIN_SEPARATOR = UniswapV2ERC20.DOMAIN_SEPARATOR();
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    // bytes32 public override(IUniswapV2Pair,UniswapV2ERC20) constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;


    uint private unlocked = 1;

    modifier lock() {
        require(unlocked == 1, "UniswapV2:LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function getReserves() public override view returns(uint112 _reserve0,uint112 _reserve1 ,uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _safeTransfer(address token,address to, uint value) private{
        (bool success , bytes memory data ) = token.call(abi.encodeWithSelector(SELECTOR,to, value));
        require(success && (data.length == 0|| abi.decode(data , (bool))) ,"UniswapV2: TRANSFER_FAILED");
    }

    // event Mint(address indexed sender, uint amount0, uint amount1);
    // event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    // event Swap(
    //     address indexed sender,
    //     uint amount0In,
    //     uint amount1In,
    //     uint amount0Out,
    //     uint amount1Out,
    //     address indexed to
    // );
    // event Sync(uint112 reserve0, uint112 reserve1);


    constructor() {
        factory = msg.sender;
    }

    function initialize(address _token0,address _token1)external override{
        require(msg.sender == factory, "UniswapV2: FORBIDDEN"); // sufficient check
        token0 = _token0;
        token1 = _token1;
    }

        // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
        require(balance0 <= uint112(int112(int112(-1))) && balance1 <= uint112(int112(-1)) ,"UniswapV2:OVERFLOW");
        // blockTimestamp 只取最后32位
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        // 计算时间差 timeElapsed
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        if(timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0){
            /*
            累积价格包含了上一次交易区块中发生的截止价格，但不会将当前区块中的最新截止价格计算进去，这个计算要等到后续区块的交易发生时进行。
            因此累积价格永远都比当前区块的最新价格（执行价格）慢那么一个区块
            */
            // 用的是reserve0 和 reserve1进行计算（上一个区块的价格），其目的是为了使当前价格比当前区块的最新价格慢一个区块
            price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0,reserve1);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        feeOn = false;
    }

        // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external lock override returns (uint liquidity) {
        (uint112 _reserve0,uint112 _reserve1,) = getReserves();

        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        // 在调用该函数前用户将token0、token1转入到该合约的数量 
        // solidity ^0.8.0 ont need safeMath
        uint amount0 = balance0 - _reserve0;
        uint amount1 = balance1 - _reserve1;


        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply= totalSupply;
        
        if (_totalSupply == 0){
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0),MINIMUM_LIQUIDITY);

        }else{
            liquidity = Math.min(amount0 * _totalSupply / _reserve0 , amount1 * _totalSupply / _reserve1);
        }

        require(liquidity > 0, "UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED");

        //将流动性通证发放给LP
        _mint(to, liquidity);

        _update(balance0 , balance1, _reserve0 , _reserve1);
        if (feeOn) kLast = uint(reserve0) * uint(reserve1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to) external lock override returns (uint amount0, uint amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply;
        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
         require(amount0 > 0 && amount1 > 0, "UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

         _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0) * uint(reserve1); // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amount0, amount1, to);

    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock override {
        require(amount0Out>0 || amount1Out >0 ,"UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        require(amount0Out < _reserve0 && amount0Out < _reserve1 , "UniswapV2: INSUFFICIENT_LIQUITY");

        uint balance0;
        uint balance1;

        { // scope for _token{0,1} , avoids stack too deep errors
        address _token0 = token0;
        address _token1 = token1;
        require(to != _token0 && to != _token1 , "UniswapV2:INVALID_TO");
        if (amount0Out > 0)_safeTransfer(_token0, to, amount0Out);
        if (amount1Out > 0)_safeTransfer(_token1, to, amount1Out);

        if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        }

        /*
        balance0 当前属于该pool的token0余额（属于池子的token0代币的最新数量）
        amount0Out token0流出数量
        _reserve0 在这个交易开始之前的token0在池子中的数量

        amount0In = balance0 - reserve0 + amount0Out
        */
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');
        {// scope for reserve{0,1}Adjusted, avoids stack too deep errors
            uint balance0Adjusted = balance0 * 1000 - amount0In * 3;
            uint balance1Adjusted = balance1 * 1000 - amount1In * 3;
            require(balance0Adjusted * balance1Adjusted >= uint(_reserve0 * _reserve1 * 1000**2), "UniswapV2: K");
        }
        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
        
    }

    // force balances to match reserves
    function skim(address to) external lock override  {
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)) - reserve0);
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)) - reserve1);
    }

    // force reserves to match balances
    function sync() external lock override{
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)), reserve0, reserve1);
    }
}