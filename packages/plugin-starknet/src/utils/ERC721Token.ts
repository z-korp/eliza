import { Account, CallData, Contract, uint256 } from "starknet";
import erc721Abi from "./erc721.json";

export type TransferCall = {
    contractAddress: string;
    entrypoint: "transferFrom";
    calldata: Array<string>;
};

export class ERC721Token {
    abi: any;
    contract: Contract;
    calldata: CallData;

    constructor(token: string, account?: Account) {
        this.contract = new Contract(erc721Abi, token, account);
        this.calldata = new CallData(this.contract.abi);
    }

    public address(): string {
        return this.contract.address;
    }

    public async ownerOf(tokenId: bigint): Promise<string> {
        const result = await this.contract.call("ownerOf", [
            uint256.bnToUint256(tokenId),
        ]);
        return result as string;
    }

    public async balanceOf(owner: string): Promise<bigint> {
        const result = await this.contract.call("balanceOf", [owner]);
        return result as bigint;
    }

    public async tokenOfOwnerByIndex(
        owner: string,
        index: bigint
    ): Promise<bigint> {
        const result = await this.contract.call("token_of_owner_by_index", [
            owner,
            uint256.bnToUint256(index),
        ]);
        return BigInt(result as bigint);
    }

    public transferCall(
        from: string,
        to: string,
        tokenId: bigint
    ): TransferCall {
        return {
            contractAddress: this.contract.address,
            entrypoint: "transferFrom",
            calldata: this.calldata.compile("transferFrom", {
                from,
                to,
                tokenId: uint256.bnToUint256(tokenId),
            }),
        };
    }

    public async approve(to: string, tokenId: bigint): Promise<void> {
        await this.contract.invoke("approve", [
            to,
            uint256.bnToUint256(tokenId),
        ]);
    }

    public async getApproved(tokenId: bigint): Promise<string> {
        const result = await this.contract.call("getApproved", [
            uint256.bnToUint256(tokenId),
        ]);
        return result as string;
    }

    public async isApprovedForAll(
        owner: string,
        operator: string
    ): Promise<boolean> {
        const result = await this.contract.call("isApprovedForAll", [
            owner,
            operator,
        ]);
        return result as boolean;
    }

    public async setApprovalForAll(
        operator: string,
        approved: boolean
    ): Promise<void> {
        await this.contract.invoke("setApprovalForAll", [operator, approved]);
    }
}
