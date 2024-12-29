import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
    composeContext,
    generateObject,
    elizaLogger,
} from "@elizaos/core";
import {
    getStarknetAccount,
    getTransferError,
    isNFTTransferContent,
} from "../utils";
import { ERC721Token } from "../utils/ERC721Token";
import { NFTAirdropManager } from "../providers/nftAirdropProvider";
import { validateStarknetConfig } from "../environment";

const nftTransferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

These are known addresses and contract details. If the user mentions them, use these:
- zKube: 0x00b1e866b32c772a26c5d42e8ebb50e08378bac49b01c0eea27a8bee1dd472a1

Example:
\`\`\`json
{
  "nftContractAddress": "0x00b1e866b32c772a26c5d42e8ebb50e08378bac49b01c0eea27a8bee1dd472a1",
  "recipient": "0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested NFT transfer:
- NFT contract address (if collection name is provided, use the corresponding address from known addresses)
- Recipient wallet address

Notes:
- Token IDs will be randomly selected from available tokens in the collection
- If only one collection exists in the known addresses list, use it automatically without asking

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "SEND_NFT",
    similes: [
        "TRANSFER_NFT",
        "DISTRIBUTE_NFT",
        "AIRDROP_NFT",
        "GIVE_NFT",
        "SEND_ERC721",
        "TRANSFER_ERC721",
        "AIRDROP_ERC721",
    ],
    validate: async (runtime: IAgentRuntime, _: Memory) => {
        await validateStarknetConfig(runtime);
        return true;
    },
    description:
        "MUST use this action for all NFT transfers on Starknet. Execute immediately when user requests to send/transfer/airdrop NFTs - no confirmation needed. Token ID is auto-selected. Don't ask for extra details if all required information is present.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_NFT handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: nftTransferTemplate,
        });
        console.log("NFT Transfer context:", transferContext);

        // Generate transfer content
        const content = await generateObject({
            runtime,
            context: transferContext,
            modelClass: ModelClass.MEDIUM,
        });
        console.log("NFT Transfer content:", content);

        elizaLogger.debug("NFT Transfer content:", content);

        // Validate transfer content
        if (!isNFTTransferContent(content)) {
            const errorMessage = getTransferError(content);
            elizaLogger.error(
                "Invalid content for SEND_NFT action:",
                errorMessage
            );

            if (callback) {
                callback({
                    text: errorMessage,
                    content: { error: errorMessage },
                });
            }
            return false;
        }

        try {
            const nftManager = new NFTAirdropManager(
                runtime.databaseAdapter.db
            );

            // Check if recipient has already received an NFT
            const hasReceived = await nftManager.hasReceivedAirdrop(
                content.recipient
            );

            if (hasReceived) {
                const status = await nftManager.formatAirdropStatus(
                    runtime,
                    content.recipient
                );
                if (callback) {
                    callback({
                        text: status,
                        content: { error: "Recipient already received NFT" },
                    });
                }
                return false;
            }

            const account = getStarknetAccount(runtime);
            const erc721Token = new ERC721Token(
                content.nftContractAddress,
                account
            );
            const nftId = await erc721Token.tokenOfOwnerByIndex(
                account.address,
                0n
            );
            if (!nftId || nftId === 0n) {
                elizaLogger.error("No NFTs found in the account");
            }
            const transferCall = erc721Token.transferCall(
                account.address,
                content.recipient,
                nftId
            );

            elizaLogger.success(
                "Transferring NFT ID",
                nftId,
                "from",
                content.nftContractAddress,
                "to",
                content.recipient
            );

            const tx = await account.execute(transferCall);

            await nftManager.recordAirdrop({
                recipientAddress: content.recipient,
                nftContractAddress: content.nftContractAddress,
                tokenId: nftId.toString(),
                transactionHash: tx.transaction_hash,
                roomId: message.roomId,
                agentId: runtime.agentId,
            });

            elizaLogger.success(
                "NFT transfer completed successfully! tx: " +
                    tx.transaction_hash
            );
            if (callback) {
                callback({
                    text:
                        "NFT transfer completed successfully! tx: " +
                        tx.transaction_hash,
                    content: {},
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during NFT transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring NFT: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Could you airdrop an NFT to my friend at address 0xABC123...",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Sure, I'll airdrop an NFT to that address right away.",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please send an NFT to this wallet: 0xDEF456...",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Absolutely, initiating the NFT transfer now.",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to gift an NFT to someone. Can you help?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Yes, I can help you send an NFT. Please provide the recipient's wallet address.",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
