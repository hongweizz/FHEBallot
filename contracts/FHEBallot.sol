// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted Zama survey
/// @notice Stores encrypted answers and tallies for a six-question questionnaire.
contract FHEBallot is ZamaEthereumConfig {
    uint8 public constant QUESTION_COUNT = 6;
    uint8 private constant MAX_OPTIONS = 4;

    struct QuestionTally {
        euint32[MAX_OPTIONS] tallies;
        bool resultsPublic;
    }

    uint8[QUESTION_COUNT] private _optionCounts;
    QuestionTally[QUESTION_COUNT] private _questions;
    mapping(address => bool) private _hasSubmitted;

    event SurveySubmitted(address indexed respondent, uint256 timestamp);
    event QuestionResultsRevealed(uint256 indexed questionId, address indexed requester);

    error InvalidQuestion(uint256 questionId);
    error AlreadyParticipated();

    constructor() {
        uint8[QUESTION_COUNT] memory optionCounts = [uint8(4), 3, 3, 4, 3, 3];
        _optionCounts = optionCounts;

        euint32 zero = FHE.asEuint32(0);
        for (uint256 i = 0; i < QUESTION_COUNT; ++i) {
            for (uint256 j = 0; j < _optionCounts[i]; ++j) {
                _questions[i].tallies[j] = zero;
                FHE.allowThis(_questions[i].tallies[j]);
            }
        }
    }

    function submitResponses(
        externalEuint32[QUESTION_COUNT] calldata encryptedChoices,
        bytes calldata proof
    ) external {
        if (_hasSubmitted[msg.sender]) {
            revert AlreadyParticipated();
        }

        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);

        for (uint256 questionId = 0; questionId < QUESTION_COUNT; ++questionId) {
            euint32 selection = FHE.fromExternal(encryptedChoices[questionId], proof);
            _applySelection(questionId, selection, one, zero);
        }

        _hasSubmitted[msg.sender] = true;
        emit SurveySubmitted(msg.sender, block.timestamp);
    }

    function _applySelection(uint256 questionId, euint32 selection, euint32 one, euint32 zero) internal {
        QuestionTally storage question = _questions[questionId];
        uint8 options = _optionCounts[questionId];

        for (uint256 optionIndex = 0; optionIndex < options; ++optionIndex) {
            ebool isMatch = FHE.eq(selection, FHE.asEuint32(uint32(optionIndex)));
            euint32 increment = FHE.select(isMatch, one, zero);

            question.tallies[optionIndex] = FHE.add(question.tallies[optionIndex], increment);
            FHE.allowThis(question.tallies[optionIndex]);
            FHE.allow(question.tallies[optionIndex], msg.sender);

            if (question.resultsPublic) {
                question.tallies[optionIndex] = FHE.makePubliclyDecryptable(question.tallies[optionIndex]);
            }
        }
    }

    modifier validQuestion(uint256 questionId) {
        if (questionId >= QUESTION_COUNT) {
            revert InvalidQuestion(questionId);
        }
        _;
    }

    function requestPublicResults(uint256 questionId) external validQuestion(questionId) {
        QuestionTally storage question = _questions[questionId];
        uint8 optionCount = _optionCounts[questionId];

        for (uint256 i = 0; i < optionCount; ++i) {
            question.tallies[i] = FHE.makePubliclyDecryptable(question.tallies[i]);
        }

        question.resultsPublic = true;
        emit QuestionResultsRevealed(questionId, msg.sender);
    }

    function getQuestionTallies(
        uint256 questionId
    )
        external
        view
        validQuestion(questionId)
        returns (euint32[MAX_OPTIONS] memory tallies, uint8 optionCount, bool isPublic)
    {
        return (_questions[questionId].tallies, _optionCounts[questionId], _questions[questionId].resultsPublic);
    }

    function getOptionCount(uint256 questionId) external view validQuestion(questionId) returns (uint8) {
        return _optionCounts[questionId];
    }

    function questionCount() external pure returns (uint8) {
        return QUESTION_COUNT;
    }

    function hasSubmitted(address account) external view returns (bool) {
        return _hasSubmitted[account];
    }
}
