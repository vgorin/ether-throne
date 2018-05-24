pragma solidity 0.4.23;

/**
 * Library for working with arbitrary length bitmaps.
 * Default initial state of any bit in the bitmap is zero.
 */
library Bitmaps {

  /// @dev Gets a bit at position `i`, doesn't throw
  function get(uint256[] memory bitmap, uint256 i) internal pure returns (uint8) {
    // extract the page number
    uint256 p = i / 256;

    // if page exists - read the value from it
    if(p < bitmap.length) {
      // extract offset from `i` as 256-bit integer
      uint256 k = i % 256;

      // extract the bit required
      return uint8(bitmap[p] << (255 - k) >> (255 - k) >> k);
    }

    // otherwise return zero
    return 0;
  }

  /// @dev Sets bit at position `i` to one
  function enable(uint256[] storage bitmap, uint256 i) internal {
    __ensureBitmapSize(bitmap, i);

    // enable the bit required
    bitmap[i / 256] |= 1 << i % 256;
  }

  /// @dev Sets bit at position `i` to zero
  function disable(uint256[] storage bitmap, uint256 i) internal {
    __ensureBitmapSize(bitmap, i);

    // disable the bit required
    bitmap[i / 256] &= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF ^ 1 << i % 256;
  }

  /// @dev Flips the state of first `bitmap.length * 256` bits
  function flipAll(uint256[] storage bitmap) internal {
    for(uint256 i = 0; i < bitmap.length; i++) {
      bitmap[i] ^= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    }
  }

  /// @dev Sets the state of all the bits outside the `length` to zero
  function trim(uint256[] storage bitmap, uint256 length) internal {
    if(length % 256 == 0) {
      bitmap.length = length / 256;
    }
    else {
      bitmap.length = length / 256 + 1;
      bitmap[bitmap.length - 1] &= (1 << length % 256) - 1;
    }
  }

  /// @dev Copies `length` uint256 elements, representing the bitmap starting at position `offset` and returns
  function bulkGet(uint256[] memory bitmap, uint16 offset, uint256 length) internal pure returns (uint256[]) {
    uint256[] memory result = new uint256[](length);
    for(uint256 i = offset; i < length && i + offset < bitmap.length; i++) {
      result[i] = bitmap[i];
    }
    return result;
  }

  /// @dev Ensures the `bitmap` data structure has enough space to store bit `i` information
  /// @dev Increases `bitmap` size if required
  function __ensureBitmapSize(uint256[] storage bitmap, uint256 i) private {
    for(uint256 j = bitmap.length; j <= i / 256; j++) {
      bitmap.push(0);
    }
  }
}
