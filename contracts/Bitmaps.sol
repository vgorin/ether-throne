pragma solidity 0.4.23;

library Bitmaps {

  function get(uint256[] memory bitmap, uint16 i) internal pure returns (uint8) {
    // extract the page number
    uint256 p = i / 256;

    // if page exists - read the value from it
    if(p < bitmap.length) {
      // extract offset from `i` as 256-bit integer
      uint256 k = uint256(i % 256);

      // extract the bit required
      return uint8(bitmap[p] << (255 - k) >> (255 - k) >> k);
    }

    // otherwise return zero
    return 0;
  }

  function enable(uint256[] storage bitmap, uint16 i) internal {
    __ensureBitmapSize(bitmap, i);

    // enable the bit required
    bitmap[i / 256] |= 1 << uint256(i % 256);
  }

  function disable(uint256[] storage bitmap, uint16 i) internal {
    __ensureBitmapSize(bitmap, i);

    // disable the bit required
    bitmap[i / 256] &= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF ^ 1 << uint256(i % 256);
  }

  function flipAll(uint256[] storage bitmap) internal {
    for(uint256 i = 0; i < bitmap.length; i++) {
      bitmap[i] ^= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    }
  }

/*
  function trim(uint256[] storage bitmap, uint16 length) internal {
    if(length % 256 == 0) {
      bitmap.length = length / 256;
    }
    else {
      bitmap.length = length / 256 + 1;
      bitmap[bitmap.length - 1] &= 1 << length % 256 - 1;
    }
  }
*/

  function bulkGet(uint256[] memory bitmap, uint16 offset, uint16 length) internal pure returns (uint256[]) {
    uint256[] memory result = new uint256[](length);
    for(uint256 i = offset; i < length && uint256(i) + offset < bitmap.length; i++) {
      result[i] = bitmap[i];
    }
    return result;
  }

  function __ensureBitmapSize(uint256[] storage bitmap, uint16 i) private {
    for(uint256 j = bitmap.length; j <= i / 256; j++) {
      bitmap.push(0);
    }
  }
}
