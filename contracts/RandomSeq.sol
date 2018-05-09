pragma solidity 0.4.23;

/**
 * Library for generating a sequence of non-repeating random numbers in range
 */
library RandomSeq {
  uint16 private constant DEFAULT_SIZE = 64;

  /// @dev Data structure containing `length` elements,
  ///      starting at position `offset`,
  ///      up to `size` elements are stored in buffer (memory/storage)
  ///      to allow random access of the elements in storage
  /// @dev First element is `offset`, last - `offset + length - 1`
  /// @dev Allows picking up elements randomly without repetition
  struct Buffer {
    // elements start from `offset`
    uint16 offset;

    // there are `length` elements in the buffer
    uint16 length;

    // number of the elements removed from the buffer,
    // initially zero, eventually length
    uint16 i;

    // initial (maximum) buffer size
    // buffer may not have this size initially if length < size
    uint16 size;

    // the buffer, current actual buffer size is buffer.length
    uint16[] buffer;
  }

  /**
   * Creates buffer with the default size
   * @param offset first element in the buffer
   * @param length number of elements in the buffer,
   *      doesn't affect memory consumption
   * @return initialized buffer's data structure
   */
  function createBuffer(uint16 offset, uint16 length) internal pure returns (Buffer) {
    // delegate call to `create` with default size
    return createBufferWith(offset, length, DEFAULT_SIZE);
  }

  /**
   * Creates a buffer
   * @param offset first element in the buffer
   * @param length number of elements in the buffer,
   *      doesn't affect memory/storage consumption
   * @param size size of the buffer in memory/storage;
   *      up to `size` numbers are loaded into buffer to
   *      allow random access of these elements
   * @return initialized buffer's data structure
   */
  function createBufferWith(uint16 offset, uint16 length, uint16 size) internal pure returns (Buffer) {
    // trim size to fit length if required
    if(size > length) {
      size = length;
    }
    // allocate number storage
    uint16[] memory buffer = new uint16[](size);

    // init buffer with numbers, starting from `offset`
    for(uint16 i = 0; i < size; i++) {
      buffer[i] = offset + i;
    }

    // return the initialized data structure
    return Buffer(offset, length, 0, size, buffer);
  }

  /**
   * @dev Pops next value from the buffer from random position
   * @dev Random value is generated internally using `__rawRandom`
   * @dev This randomness is not cryptographically secure
   *      and may be heavily influenced by miners, but its cheap though
   * @dev Throws if buffer is empty
   * @param buf source of the values to pop from
   */
  function nextRandom(Buffer storage buf) internal returns (uint16) {
    // generate some randomness to work with on our own
    uint16 randomness = uint16(__rawRandom());

    // delegate call to `nextRandomWith`
    return nextRandomWith(buf, randomness);
  }

  /**
   * @dev Pops next value from the buffer from random position
   * @dev Throws if buffer is empty
   * @param buf source of the values to pop from
   * @param randomness random value used to derive random position in buffer
   */
  function nextRandomWith(Buffer storage buf, uint256 randomness) internal returns (uint16) {
    // generate random index within the buffer bounds
    uint16 i = uint16(__rndVal(randomness, 0xFFFF, 0, buf.buffer.length));

    // delegate call to `__next`
    return __next(buf, i);
  }

  /**
   * @dev Checks if buffer has at least one more value to pop
   * @param buf source of the values to pop from
   */
  function hasNext(Buffer storage buf) internal constant returns (bool) {
    // if there are values left, then we have next value
    return valuesLeft(buf) > 0;
  }

  /**
   * @dev Checks how many values left in the buffer
   * @param buf source of the values to pop from
   */
  function valuesLeft(Buffer storage buf) internal constant returns (uint16) {
    // `i` elements consumed out of `length` elements
    return buf.length - buf.i;
  }

  /// @dev Pops next value from the buffer from given position
  /// @dev Throws if buffer is empty
  /// @param buf source of the values to pop from
  /// @param i index to pop value from;
  ///     the value is trimmed to fit into buffer length
  function __next(Buffer storage buf, uint16 i) private returns (uint16) {
    // make sure i doesn't exceed buffer's length
    i %= uint16(buf.buffer.length);

    // get the value from the buffer
    uint16 value = buf.buffer[i];

    // if there are elements out of the buffer, move one of them into the buffer
    if(buf.i + buf.size < buf.length) {
      // basically this generates a next value in the sequence
      // and puts it into the buffer into the released position `i`
      buf.buffer[i] = buf.offset + buf.size + buf.i;
    }
    // if there are no elements out of buffer, shrink the buffer itself
    else {
      // move the last element from the buffer into the released position `i`
      // if this is the last element in the buffer, this line does nothing
      buf.buffer[i] = buf.buffer[buf.buffer.length - 1];
      // shrink buffer size - removes last buffer element from storage
      buf.buffer.length--;
    }

    // update removed elements counter
    buf.i++;

    // return the result
    return value;
  }

  /**
   * @dev Extracts a random value in range [offset, offset + length),
   *      from the `randomness` given after applying a `mask`
   * @dev mask - maximum value the `randomness` can have,
   *      for example, if `randomness` is 32-bits long, `mask` = 0xFFFFFFFF,
   *                   if `randomness` is 16-bits long, `mask` = 0xFFFF
   * @param randomness source of randomness
   * @param mask maximum value the `randomness` can have
   * @param offset lower output bound
   * @param length number of possible output values, upper bound is `offset + length - 1`
   * @return random value in range [offset, offset + length)
   */
  function __rndVal(uint256 randomness, uint256 mask, uint256 offset, uint256 length) internal pure returns (uint256) {
    // return random value in range [offset, offset + length)
    return offset + (mask & randomness) * length / (mask + 1);
  }

  /**
   * @dev Generates random value in range [offset, offset + length)
   *      based on the `__rawRandom` as a source of a randomness
   * @dev The random value generated is not cryptographically secure
   *      and may be heavily influenced by miners, but its cheap though
   * @param offset lower output bound
   * @param length number of possible output values, upper bound is `offset + length - 1`
   * @return random value in range [offset, offset + length)
   */
  function __randomValue(uint256 offset, uint256 length) internal constant returns (uint256) {
    // using `__rawRandom` as a source of randomness,
    uint256 randomness = __rawRandom();

    // delegate call to `__rndVal` using only 128 bits of randomness
    return  __rndVal(randomness, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, offset, length);
  }

  /**
   * @dev Generates random value based on keccak256 hash of
   *      * block.difficulty,
   *      * block.number,
   *      * gasleft(),
   *      * msg.data,
   *      * msg.sender,
   *      * msg.value,
   *      * tx.gasprice,
   *      * tx.origin
   * @dev The random value generated is not cryptographically secure
   *      and may be heavily influenced by miners, but its cheap though
   * @return random value – all possible values of uint256
   */
  function __rawRandom() internal constant returns (uint256) {
    // build the keccak256 hash of the transaction dependent values
    bytes32 hash = keccak256(
        block.difficulty,
        block.number,
        gasleft(),
        msg.data,
        msg.sender,
        msg.value,
        tx.gasprice,
        tx.origin
      );
    // and return the result
    return uint256(hash);
  }
}
