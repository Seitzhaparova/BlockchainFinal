// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGameBank {
    function deposit(address player, uint256 amount) external;
    function payout(address[] calldata winners) external returns (uint256 payoutPerWinner, uint256 totalPot);
    function refund(address[] calldata players) external;
}

contract GameRoom {
    enum Phase { Lobby, Styling, Voting, Ended, Canceled }

    IERC20 public token;
    IGameBank public bank;

    address public host;
    uint256 public betAmount;
    uint256 public maxPlayers;

    uint256 public topicId;

    Phase public phase;

    uint256 public stylingDeadline;
    uint256 public votingDeadline;

    uint256 public stylingDuration;
    uint256 public votingDuration;

    address[] public players;
    mapping(address => bool) public joined;

    // Outfit is stored as uint256 code (you can pack asset IDs into it)
    mapping(address => uint256) public outfitOf;
    mapping(address => bool) public submitted;
    uint256 public submittedCount;

    // Voting results: target => totalStars and countVotes
    mapping(address => uint256) public totalStars;
    mapping(address => uint256) public voteCount;
    mapping(address => bool) public hasVoted;

    address[] public winners;
    uint256 public finalPot;
    uint256 public payoutPerWinner;

    event PlayerJoined(address indexed player, uint256 totalPlayers);
    event GameStarted(uint256 stylingDeadline);
    event OutfitSubmitted(address indexed player, uint256 outfitCode);
    event VotingStarted(uint256 votingDeadline);
    event VoteCast(address indexed voter, address indexed target, uint8 stars);
    event Finalized(address[] winners, uint256 finalPot, uint256 payoutPerWinner);
    event GameCanceled();

    modifier onlyHost() {
        require(msg.sender == host, "Only host");
        _;
    }

    modifier onlyPlayer() {
        require(joined[msg.sender], "Only player");
        _;
    }

    constructor(
        address _token,
        address _bank,
        address _host,
        uint256 _betAmount,
        uint256 _maxPlayers,
        uint256 _topicId,
        uint256 _stylingDuration,
        uint256 _votingDuration
    ) {
        token = IERC20(_token);
        bank = IGameBank(_bank);
        host = _host;
        betAmount = _betAmount;
        maxPlayers = _maxPlayers;
        topicId = _topicId;

        stylingDuration = _stylingDuration;
        votingDuration = _votingDuration;

        phase = Phase.Lobby;
    }

    // Join requires approving BANK for betAmount
    function joinGame() external {
        require(phase == Phase.Lobby, "Not lobby");
        require(players.length < maxPlayers, "Room full");
        require(!joined[msg.sender], "Already joined");

        bank.deposit(msg.sender, betAmount);

        joined[msg.sender] = true;
        players.push(msg.sender);

        emit PlayerJoined(msg.sender, players.length);
    }

    // Host can start with >= 2 players (including host)
    function startGame() external onlyHost {
        require(phase == Phase.Lobby, "Not lobby");
        require(players.length >= 1, "Need 1+ players");
        phase = Phase.Styling;
        stylingDeadline = block.timestamp + stylingDuration;

        emit GameStarted(stylingDeadline);
    }

    // Submit outfit during Styling
    function submitOutfit(uint256 outfitCode) external onlyPlayer {
        require(phase == Phase.Styling, "Not styling");
        require(!submitted[msg.sender], "Already submitted");

        submitted[msg.sender] = true;
        outfitOf[msg.sender] = outfitCode;
        submittedCount++;

        emit OutfitSubmitted(msg.sender, outfitCode);
    }

    // Host starts voting after:
    // - at least 2 submitted
    // - and (deadline passed OR all players submitted)
    function startVoting() external onlyHost {
        require(phase == Phase.Styling, "Not styling");
        require(submittedCount >= 1, "Need 1+ outfits");

        bool allSubmitted = (submittedCount == players.length);
        bool timeUp = (block.timestamp >= stylingDeadline);
        require(allSubmitted || timeUp, "Wait outfits or time");

        phase = Phase.Voting;
        votingDeadline = block.timestamp + votingDuration;

        emit VotingStarted(votingDeadline);
    }

    // One TX voting: rate multiple targets
    function castVotes(address[] calldata targets, uint8[] calldata stars) external onlyPlayer {
        require(phase == Phase.Voting, "Not voting");
        require(!hasVoted[msg.sender], "Already voted");
        require(targets.length == stars.length, "Length mismatch");
        require(targets.length > 0, "Empty votes");

        hasVoted[msg.sender] = true;

        for (uint256 i = 0; i < targets.length; i++) {
            address t = targets[i];
            require(t != msg.sender, "No self vote");
            require(joined[t], "Target not player");
            require(submitted[t], "Target no outfit");
            require(stars[i] <= 5, "Stars 0..5");

            totalStars[t] += stars[i];
            voteCount[t] += 1;

            emit VoteCast(msg.sender, t, stars[i]);
        }
    }

    // Anyone can finalize when:
    // - voting deadline passed OR all players voted
    function finalize() external {
        require(phase == Phase.Voting, "Not voting");
        require(block.timestamp >= votingDeadline || _allVoted(), "Wait votes/time");

        // Find max average score among submitted players
        uint256 bestScoreScaled = 0; // avg * 1e6
        uint256 submittedPlayers = 0;

        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            if (!submitted[p]) continue;

            submittedPlayers++;

            uint256 vc = voteCount[p];
            uint256 avgScaled = 0;
            if (vc > 0) {
                avgScaled = (totalStars[p] * 1_000_000) / vc;
            }

            if (avgScaled > bestScoreScaled) {
                bestScoreScaled = avgScaled;
            }
        }

        require(submittedPlayers >= 2, "Not enough outfits");

        // Collect winners (ties allowed)
        delete winners;
        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            if (!submitted[p]) continue;

            uint256 vc = voteCount[p];
            uint256 avgScaled = (vc > 0) ? (totalStars[p] * 1_000_000) / vc : 0;

            if (avgScaled == bestScoreScaled) {
                winners.push(p);
            }
        }

        require(winners.length > 0, "No winners");

        // payout
        (uint256 perWinner, uint256 potAmount) = bank.payout(winners);
        payoutPerWinner = perWinner;
        finalPot = potAmount;

        phase = Phase.Ended;
        emit Finalized(winners, finalPot, payoutPerWinner);
    }

    function cancelGame() external onlyHost {
        require(phase == Phase.Lobby || phase == Phase.Styling, "Too late");
        bank.refund(players);
        phase = Phase.Canceled;
        emit GameCanceled();
    }

    // Views
    function getPlayers() external view returns (address[] memory) {
        return players;
    }

    function getWinners() external view returns (address[] memory, uint256, uint256) {
        return (winners, finalPot, payoutPerWinner);
    }

    function getOutfit(address player) external view returns (bool hasOutfit, uint256 outfitCode) {
        return (submitted[player], outfitOf[player]);
    }

    function _allVoted() internal view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (!hasVoted[players[i]]) return false;
        }
        return true;
    }
}
