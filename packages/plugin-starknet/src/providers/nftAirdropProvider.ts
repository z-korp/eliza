import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";
import { NFTAirdropDatabase } from "../adapters/nftAirdrop";
import { Database } from "better-sqlite3";
import NodeCache from "node-cache";

/**
 * Manages NFT airdrops using a database and cache layer.
 */
export class NFTAirdropManager {
    private db: NFTAirdropDatabase;
    private cache: NodeCache;

    constructor(db: Database) {
        this.db = new NFTAirdropDatabase(db);
        this.cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
    }

    async recordAirdrop(params: {
        recipientAddress: string;
        nftContractAddress: string;
        tokenId: string;
        transactionHash: string;
        roomId: string;
        agentId: string;
    }): Promise<boolean> {
        return this.db.recordAirdrop(params);
    }

    /**
     * Checks if a wallet address has received an airdrop.
     * Results are cached for faster subsequent queries.
     * @param address The recipient's wallet address.
     * @returns `true` if the address has received an airdrop, otherwise `false`.
     */
    async hasReceivedAirdrop(address: string): Promise<boolean> {
        const cacheKey = `airdrop-status:${address}`;
        const cachedValue = this.cache.get<boolean>(cacheKey);

        if (cachedValue !== undefined) {
            console.log(`[Cache] Hit for key: ${cacheKey}`);
            return cachedValue;
        }

        console.log(`[Cache] Miss for key: ${cacheKey}`);
        try {
            const hasReceived = this.db.hasReceivedAirdrop(address);
            this.cache.set(cacheKey, hasReceived);
            return hasReceived;
        } catch (error) {
            console.error("Error checking airdrop status:", error);
            return false;
        }
    }

    /**
     * Retrieves airdrop history for a recipient.
     * Results are cached for faster subsequent queries.
     * @param params Filters for the airdrop history query.
     * @returns Array of airdrop records.
     */
    async getAirdropHistory(params: {
        recipientAddress: string;
        limit?: number;
    }): Promise<any[]> {
        const cacheKey = `airdrop-history:${params.recipientAddress}`;
        const cachedValue = this.cache.get<any[]>(cacheKey);

        if (cachedValue) {
            console.log(`[Cache] Hit for key: ${cacheKey}`);
            return cachedValue;
        }

        console.log(`[Cache] Miss for key: ${cacheKey}`);
        try {
            const history = this.db.getAirdropHistory(params);
            this.cache.set(cacheKey, history);
            return history;
        } catch (error) {
            console.error("Error retrieving airdrop history:", error);
            return [];
        }
    }

    /**
     * Formats the airdrop status of a wallet address.
     * @param runtime Runtime instance for additional context if needed.
     * @param address The wallet address to check.
     * @returns A formatted string describing the airdrop status.
     */
    async formatAirdropStatus(
        runtime: IAgentRuntime,
        address: string
    ): Promise<string> {
        try {
            const hasReceived = await this.hasReceivedAirdrop(address);

            if (hasReceived) {
                const airdropHistory = await this.getAirdropHistory({
                    recipientAddress: address,
                    limit: 1,
                });

                if (airdropHistory.length > 0) {
                    const airdrop = airdropHistory[0];
                    const date = new Date(
                        airdrop.airdropTimestamp
                    ).toLocaleString();
                    return `Address ${address} has already received an NFT (${airdrop.tokenId}) on ${date}.\nTransaction hash: ${airdrop.transactionHash}`;
                }

                return `Address ${address} has already received an NFT.`;
            }

            return `Address ${address} has not received an NFT airdrop yet.`;
        } catch (error) {
            console.error(
                `Error formatting airdrop status for address ${address}:`,
                error
            );
            return `Failed to fetch airdrop status for address ${address}.`;
        }
    }
}

/**
 * Provider for querying NFT airdrop status.
 */
const nftAirdropProvider: Provider = {
    /**
     * Retrieves the airdrop status for a specific wallet address.
     * @param runtime Runtime instance for executing tasks.
     * @param message Message containing the recipient's address.
     * @param _state Optional state object (not used here).
     * @returns A string describing the airdrop status.
     */
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            console.log(
                "Checking NFT airdrop status..." + message.content?.recipient
            );
            console.log("Checking NFT airdrop status..." + message.content);
            const address = message.content?.recipient;

            if (!address || typeof address !== "string") {
                console.error("Invalid or missing recipient address");
                return `Invalid recipient address provided.`;
            }

            const manager = new NFTAirdropManager(runtime.databaseAdapter.db);
            return await manager.formatAirdropStatus(runtime, address);
        } catch (error) {
            console.error("Error in NFT airdrop provider:", error);
            return `Failed to check airdrop status: ${
                error instanceof Error ? error.message : "Unknown error"
            }`;
        }
    },
};

export { nftAirdropProvider };
