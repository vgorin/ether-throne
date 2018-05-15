pragma solidity 0.4.23;

import "./CharacterCard.sol";

/**
 * @dev Battle provider is a card operator responsible for
 *      enabling card battle protocol
 */
contract BattleProvider {
  /// @dev Default bitmask indicating that the card is `in game`
  /// @dev Consists of a single bit at position 3 – binary 100
  /// @dev This bit is cleared by `battleComplete`
  /// @dev First 2 lower bits are used by the last game status outcome data:
  ///      0: undefined
  ///      1: defeat
  ///      2: draw
  ///      3: victory
  uint8 public constant DEFAULT_IN_BATTLE_BIT = 0x4; // bit number 3
  /// @dev Bits 1-2 mask, used to read/write game outcome data
  uint8 public constant LAST_GAME_OUTCOME_BITS = 0x3; // bits 1-2
  /// @dev Bits 1-3 mask, used in battleComplete to clear game outcome and card state
  uint8 public constant BATTLE_COMPLETE_CLEAR_BITS = 0x7; // bits 1-3: outcome + in game
  /// @dev Constant indicating no game outcome (card never played a game)
  uint8 public constant GAME_OUTCOME_UNDEFINED = 0;
  /// @dev Constant indicating the defeat of a card (victory of an opponent card)
  uint8 public constant GAME_OUTCOME_DEFEAT = 1;
  /// @dev Constant indicating the draw
  uint8 public constant GAME_OUTCOME_DRAW = 2;
  /// @dev Constant indicating victory of a card (defeat of an opponent card)
  uint8 public constant GAME_OUTCOME_VICTORY = 3;

  /// @dev A character card battle stats data structure
  /// @dev Occupies 64 bytes of storage (512 bits)
  struct BattleStats {
    /// @dev Initially zero, changes after each game played
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's played a game (released from a game)
    uint32 lastGamePlayed;

    /// @dev Initially zero, increases after each game played
    uint32 gamesPlayed;

    /// @dev Initially zero, increases after each game won
    uint32 wins;

    /// @dev Initially zero, increases after each game lost
    uint32 losses;

    uint8 lastGameOutcome;

    /// @dev Card ID, immutable, cannot be zero
    uint16 cardId;
  }

  /// @dev All the battle statistics, handled by this instance
  mapping(uint16 => BattleStats) public battleStats;

  /// @dev CharacterCard deployed ERC721 instance
  /// @dev Used to mint cards
  /// @dev Battle provider smart contract must have appropriate permissions
  ///      on the deployed CharacterCard
  CharacterCard public cardInstance;

  /// @dev Fired in battlesComplete(), battleComplete()
  event BattleComplete(
    address indexed owner1,// card1 owner
    address indexed owner2,// card2 owner
    uint16 card1Id,        // card1 ID
    uint16 card2Id,        // card2 ID
    uint32 wins,           // card1 wins = card2 losses
    uint32 losses,         // card1 losses = card2 wins
    uint32 gamesPlayed,    // card1 games played = card2 games played
    uint8  lastGameOutcome // card1 last game outcome = 4 - card2 last game outcome
  );

  /**
   * @dev Creates a new battle provider instance, bound to a
   *      CharacterCard instance deployed at specified address
   */
  constructor(address cardInstanceAddress) public {
    cardInstance = CharacterCard(cardInstanceAddress);
  }

  /**
   * @dev A mechanism to update two cards which were engaged in a battle
   * @param card1Id first card's ID engaged in a battle
   * @param card2Id second card's ID engaged in a battle
   * @param outcome game outcome,
   *      1 means that first card lost and second card won,
   *      2 means draw,
   *      3 means that first card won and second card lost
   */
  function battleComplete(uint16 card1Id, uint16 card2Id, uint8 outcome) public {
    // the check if outcome is one of [1, 2, 3] is done in
    // a call to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`

    // prepare wins/losses variables to delegate call
    // to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`
    uint32 wins = outcome == GAME_OUTCOME_VICTORY? 1: 0;
    uint32 losses = outcome == GAME_OUTCOME_DEFEAT? 1: 0;

    // delegate call to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`
    battlesComplete(card1Id, card2Id, wins, losses, 1, outcome);
  }

  /**
   * @dev A mechanism to update two cards which were engaged in several battles
   * @dev Same as `battleComplete(uint16, uint16, outcome)` but allows for a batch update
   * @param card1Id first card's ID engaged in a battle
   * @param card2Id second card's ID engaged in a battle
   * @param wins number of times 1st card won (2nd lost)
   * @param losses number of times 1st card lost (2nd won)
   * @param gamesPlayed total games played, cannot exceed wins + losses, cannot be zero
   */
  function battlesComplete(
    uint16 card1Id,
    uint16 card2Id,
    uint32 wins,
    uint32 losses,
    uint32 gamesPlayed,
    uint8 lastGameOutcome
  ) public {
    // arithmetic overflow check
    require(wins <= wins + losses);
    // first check is enough, symmetric situation is impossible
    assert(losses <= wins + losses);

    // input data sanity check
    require(gamesPlayed != 0);
    require(wins + losses <= gamesPlayed);

    // check if last game outcome is one of [1, 2, 3]
    // check if it is consistent with wins/losses counters
    require(lastGameOutcome == GAME_OUTCOME_DEFEAT && losses != 0   // defeat means losses cannot be zero
         || lastGameOutcome == GAME_OUTCOME_DRAW && wins + losses < gamesPlayed
         || lastGameOutcome == GAME_OUTCOME_VICTORY && wins != 0); // victory means wins cannot be zero

    // get cards from the storage
    BattleStats storage stats1 = battleStats[card1Id];
    BattleStats storage stats2 = battleStats[card2Id];

    // arithmetic overflow checks before updating cards
    require(stats1.gamesPlayed + gamesPlayed > stats1.gamesPlayed);
    require(stats2.gamesPlayed + gamesPlayed > stats2.gamesPlayed);

    // no need to check for arithmetic overflows in wins/losses,
    // since these numbers cannot exceed gamesPlayed number
    // if these validations do not pass – it's a bug
    assert(stats1.wins + wins >= stats1.wins);
    assert(stats1.losses + losses >= stats1.losses);
    assert(stats2.wins + losses >= stats2.wins);
    assert(stats2.losses + wins >= stats2.losses);

    // check if both card exist
    assert(cardInstance.exists(card1Id));
    assert(cardInstance.exists(card2Id));

    // extract card owners
    address owner1 = cardInstance.ownerOf(card1Id);
    address owner2 = cardInstance.ownerOf(card2Id);

    // check if two cards have different owners
    require(owner1 != owner2);
    
    // update games played counters
    stats1.gamesPlayed += gamesPlayed;
    stats2.gamesPlayed += gamesPlayed;

    // update outcomes
    // for card1 its straight forward
    stats1.wins += wins;
    stats1.losses += losses;
    // for card2 its vice versa (card1 victory = card2 defeat)
    stats2.wins += losses;
    stats2.losses += wins;

    // update last game played timestamps
    stats1.lastGamePlayed = uint32(block.number);
    stats2.lastGamePlayed = uint32(block.number);

    // clear 'in game' bit for both cards – move cards out of game
    cardInstance.removeStateAttributes(card1Id, DEFAULT_IN_BATTLE_BIT);
    cardInstance.removeStateAttributes(card2Id, DEFAULT_IN_BATTLE_BIT);

    // update last game played outcome
    stats1.lastGameOutcome = lastGameOutcome;
    stats2.lastGameOutcome = 4 - lastGameOutcome;
    
    // fire an event
    emit BattleComplete(owner1, owner2, card1Id, card2Id, wins, losses, gamesPlayed, lastGameOutcome);
  }

}
