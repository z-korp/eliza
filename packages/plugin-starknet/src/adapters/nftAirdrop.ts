import { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

export interface NFTAirdrop {
    id: string;
    recipientAddress: string;
    nftContractAddress: string;
    tokenId: string;
    transactionHash?: string;
    airdropTimestamp: number;
    roomId: string;
    agentId: string;
}

export class NFTAirdropDatabase {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        this.initializeSchema();
    }

    private initializeSchema() {
        console.log("qqqqqqqqq CREATE TABLE IF NOT EXISTS nft_airdrops");
        // Create tables and indexes if they don't exist
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS nft_airdrops (
                id TEXT PRIMARY KEY,
                recipient_address TEXT NOT NULL,
                nft_contract_address TEXT NOT NULL,
                token_id TEXT NOT NULL,
                transaction_hash TEXT,
                airdrop_timestamp INTEGER NOT NULL,
                room_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                UNIQUE(recipient_address, nft_contract_address, token_id)
            );
            CREATE INDEX IF NOT EXISTS idx_recipient_address ON nft_airdrops(recipient_address);
            CREATE INDEX IF NOT EXISTS idx_room_agent ON nft_airdrops(room_id, agent_id);
        `);
    }

    /**
     * Check if a wallet address has already received an NFT airdrop.
     * @param recipientAddress Wallet address to check.
     * @returns True if the recipient has received an airdrop, otherwise false.
     */
    hasReceivedAirdrop(recipientAddress: string): boolean {
        try {
            const sql = `
                SELECT COUNT(*) as count 
                FROM nft_airdrops 
                WHERE recipient_address = ?
            `;
            const result = this.db.prepare(sql).get(recipientAddress) as {
                count: number;
            };
            return result.count > 0;
        } catch (error) {
            console.error(
                "Error checking if recipient received airdrop:",
                error
            );
            return false;
        }
    }

    /**
     * Record a new NFT airdrop.
     * @param params NFTAirdrop details excluding `id` and `airdropTimestamp`.
     * @returns True if the airdrop was successfully recorded, otherwise false.
     */
    recordAirdrop(
        params: Omit<NFTAirdrop, "id" | "airdropTimestamp">
    ): boolean {
        const airdrop: NFTAirdrop = {
            id: uuidv4(),
            airdropTimestamp: Date.now(),
            ...params,
        };

        try {
            const sql = `
                INSERT INTO nft_airdrops (
                    id, recipient_address, nft_contract_address, token_id,
                    transaction_hash, airdrop_timestamp, room_id, agent_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.db
                .prepare(sql)
                .run(
                    airdrop.id,
                    airdrop.recipientAddress,
                    airdrop.nftContractAddress,
                    airdrop.tokenId,
                    airdrop.transactionHash || null,
                    airdrop.airdropTimestamp,
                    airdrop.roomId,
                    airdrop.agentId
                );
            return true;
        } catch (error) {
            console.error("Error recording NFT airdrop:", error);
            return false;
        }
    }

    /**
     * Get airdrop history with optional filters.
     * @param params Optional filters for querying airdrop history.
     * @returns Array of NFTAirdrop objects.
     */
    getAirdropHistory(params: {
        roomId?: string;
        agentId?: string;
        recipientAddress?: string;
        limit?: number;
    }): NFTAirdrop[] {
        try {
            let sql = "SELECT * FROM nft_airdrops WHERE 1=1";
            const queryParams: any[] = [];

            if (params.roomId) {
                sql += " AND room_id = ?";
                queryParams.push(params.roomId);
            }

            if (params.agentId) {
                sql += " AND agent_id = ?";
                queryParams.push(params.agentId);
            }

            if (params.recipientAddress) {
                sql += " AND recipient_address = ?";
                queryParams.push(params.recipientAddress);
            }

            sql += " ORDER BY airdrop_timestamp DESC";

            if (params.limit) {
                sql += " LIMIT ?";
                queryParams.push(params.limit);
            }

            const rows = this.db.prepare(sql).all(...queryParams);
            return rows.map((row: any) => ({
                id: row.id,
                recipientAddress: row.recipient_address,
                nftContractAddress: row.nft_contract_address,
                tokenId: row.token_id,
                transactionHash: row.transaction_hash || undefined,
                airdropTimestamp: row.airdrop_timestamp,
                roomId: row.room_id,
                agentId: row.agent_id,
            }));
        } catch (error) {
            console.error("Error retrieving airdrop history:", error);
            return [];
        }
    }

    /**
     * Get total airdrop statistics with optional filters.
     * @param params Optional filters for querying statistics.
     * @returns Object containing total airdrops and unique recipients.
     */
    getAirdropStats(params: {
        roomId?: string;
        agentId?: string;
        startTime?: number;
        endTime?: number;
    }): { totalAirdrops: number; uniqueRecipients: number } {
        try {
            let sql = `
                SELECT 
                    COUNT(*) as totalAirdrops,
                    COUNT(DISTINCT recipient_address) as uniqueRecipients
                FROM nft_airdrops 
                WHERE 1=1
            `;
            const queryParams: any[] = [];

            if (params.roomId) {
                sql += " AND room_id = ?";
                queryParams.push(params.roomId);
            }

            if (params.agentId) {
                sql += " AND agent_id = ?";
                queryParams.push(params.agentId);
            }

            if (params.startTime) {
                sql += " AND airdrop_timestamp >= ?";
                queryParams.push(params.startTime);
            }

            if (params.endTime) {
                sql += " AND airdrop_timestamp <= ?";
                queryParams.push(params.endTime);
            }

            return this.db.prepare(sql).get(...queryParams) as {
                totalAirdrops: number;
                uniqueRecipients: number;
            };
        } catch (error) {
            console.error("Error retrieving airdrop statistics:", error);
            return { totalAirdrops: 0, uniqueRecipients: 0 };
        }
    }
}
