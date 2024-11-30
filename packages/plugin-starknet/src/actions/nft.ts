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
} from "@ai16z/eliza";
import { getStarknetAccount, isNFTTransferContent } from "../utils";
import { validateStarknetConfig } from "../enviroment";
import { ERC721Token } from "../utils/ERC721Token";

const nftTransferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

These are known addresses and contract details. If the user mentions them, use these:
- zKube: 0x00b1e866b32c772a26c5d42e8ebb50e08378bac49b01c0eea27a8bee1dd472a1

Example response:
\`\`\`json
{
  "nftContractAddress": "0x00b1e866b32c772a26c5d42e8ebb50e08378bac49b01c0eea27a8bee1dd472a1",
  "recipient": "0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested NFT transfer:
- NFT contract address
- Recipient wallet address

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "SEND_NFT",
    similes: [
        "TRANSFER_NFT_ON_STARKNET",
        "SEND_NFT_ON_STARKNET",
        "DISTRIBUTE_NFT_ON_STARKNET",
        "TRANSFER_ERC721_ON_STARKNET",
        "SEND_ERC721_ON_STARKNET",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateStarknetConfig(runtime);
        return true;
    },
    description:
        "MUST use this action if the user requests to send an NFT or transfer an ERC721 token. The request might vary, but it will always involve transferring an NFT.",
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
            elizaLogger.error("Invalid content for SEND_NFT action.");
            if (callback) {
                callback({
                    text: "Not enough information to transfer the NFT. Please provide the NFT contract address and recipient.",
                    content: { error: "Invalid transfer content" },
                });
            }
            return false;
        }

        try {
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
                    text: "Give a zKube nft to 0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll transfer one nft to that address right away. Let me process that for you.",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Transfer one of your zkube nft to 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Executing transfer of one zkube NFT to the specified address. One moment please.",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
