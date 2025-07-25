// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IVerifier} from "./IVerifier.sol";

contract Panagram is ERC1155, Ownable {
    IVerifier public s_verifier;
    uint256 public s_roundStartTime;
    bytes32 public s_correctAnswerHash;
    address public s_currentRoundWinner;
    uint256 public s_currentRound;

    mapping(address => uint256) public s_lastCorrectGuessRound;
    mapping(address => uint256) public s_winnerWins;

    uint256 public constant MIN_ROUND_DURATION = 1 days;
    uint256 public constant WINNER_TOKEN_ID = 0;
    uint256 public constant PARTICIPANT_TOKEN_ID = 1;

    event Panagram__VerifierUpdated(IVerifier verifier);
    event Panagram__NewRoundStarted(uint256 round, uint256 startTime);
    event Panagram__CorrectGuess(
        address indexed player,
        uint256 round,
        bool isWinner,
        uint256 tokenId
    );

    error Panagram__MinRoundDurationNotMet(uint256 timeLeft);
    error Panagram__NoRoundWinner();
    error Panagram__GameNotStarted();
    error Panagram__AlreadyGuessedThisRound();
    error Panagram__InvalidProof();

    constructor(
        address _verifier
    )
        ERC1155(
            "ipfs://bafybeicqfc4ipkle34tgqv3gh7gccwhmr22qdg7p6k6oxon255mnwb6csi/{id}.json"
        )
        Ownable(msg.sender)
    {
        s_verifier = IVerifier(_verifier);
    }

    function newRound(bytes32 _correctAnswerHash) external onlyOwner {
        if (s_roundStartTime != 0) {
            if (block.timestamp < s_roundStartTime + MIN_ROUND_DURATION) {
                revert Panagram__MinRoundDurationNotMet(
                    s_roundStartTime + MIN_ROUND_DURATION - block.timestamp
                );
            }
            if (s_currentRoundWinner == address(0)) {
                revert Panagram__NoRoundWinner();
            }
            s_currentRoundWinner = address(0);
        }

        s_correctAnswerHash = _correctAnswerHash;
        s_roundStartTime = block.timestamp;
        s_currentRound++;
        emit Panagram__NewRoundStarted(s_currentRound, s_roundStartTime);
    }

    function makeGuess(bytes memory _proof) external returns (bool) {
        // Input validation
        if (s_currentRound == 0) {
            revert Panagram__GameNotStarted();
        }
        if (s_lastCorrectGuessRound[msg.sender] == s_currentRound) {
            revert Panagram__AlreadyGuessedThisRound();
        }

        // Verify the proof
        bytes32[] memory inputs = new bytes32[](1);
        inputs[0] = s_correctAnswerHash;
        bool isProofValid = s_verifier.verify(_proof, inputs);
        if (!isProofValid) {
            revert Panagram__InvalidProof();
        }

        // Record successful guess
        s_lastCorrectGuessRound[msg.sender] = s_currentRound;

        // Handle rewards
        bool isWinner = s_currentRoundWinner == address(0);
        uint256 tokenId;

        if (isWinner) {
            s_currentRoundWinner = msg.sender;
            s_winnerWins[msg.sender]++;
            tokenId = WINNER_TOKEN_ID;
        } else {
            tokenId = PARTICIPANT_TOKEN_ID;
        }

        // Mint NFT reward
        _mint(msg.sender, tokenId, 1, "");
        emit Panagram__CorrectGuess(
            msg.sender,
            s_currentRound,
            isWinner,
            tokenId
        );

        return true;
    }

    function setVerifier(IVerifier _verifier) external onlyOwner {
        s_verifier = _verifier;
        emit Panagram__VerifierUpdated(_verifier);
    }
}
