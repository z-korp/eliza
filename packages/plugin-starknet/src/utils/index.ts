import { Content, elizaLogger, IAgentRuntime } from "@ai16z/eliza";
import { Fraction, Percent } from "@uniswap/sdk-core";
import { Account, Contract, RpcProvider } from "starknet";

export const getTokenBalance = async (
    runtime: IAgentRuntime,
    tokenAddress: string
) => {
    const provider = getStarknetProvider(runtime);

    const { abi: tokenAbi } = await provider.getClassAt(tokenAddress);
    if (tokenAbi === undefined) {
        throw new Error("no abi.");
    }

    const tokenContract = new Contract(tokenAbi, tokenAddress, provider);

    tokenContract.connect(getStarknetAccount(runtime));

    return await tokenContract.balanceOf(tokenAddress);
};

export const getStarknetProvider = (runtime: IAgentRuntime) => {
    return new RpcProvider({
        nodeUrl: runtime.getSetting("STARKNET_RPC_URL"),
    });
};

export const getStarknetAccount = (runtime: IAgentRuntime) => {
    return new Account(
        getStarknetProvider(runtime),
        runtime.getSetting("STARKNET_ADDRESS"),
        runtime.getSetting("STARKNET_PRIVATE_KEY")
    );
};

export interface TransferContent extends Content {
    tokenAddress: string;
    recipient: string;
    amount: string | number;
}

export function isTransferContent(
    content: TransferContent
): content is TransferContent {
    console.log("isTransferContent", content);
    // Validate types
    const validTypes =
        typeof content.tokenAddress === "string" &&
        typeof content.recipient === "string" &&
        (typeof content.amount === "string" ||
            typeof content.amount === "number");
    if (!validTypes) {
        return false;
    }

    // Validate addresses (must be 32-bytes long with 0x prefix)
    const validAddresses =
        content.tokenAddress.startsWith("0x") &&
        content.tokenAddress.length === 66 &&
        content.recipient.startsWith("0x") &&
        content.recipient.length === 66;

    return validAddresses;
}

export interface NFTTransferContent extends Content {
    nftContractAddress: string;
    recipient: string;
}

export function isNFTTransferContent(
    content: NFTTransferContent
): content is NFTTransferContent {
    // Validate types
    const validTypes =
        typeof content.nftContractAddress === "string" &&
        typeof content.recipient === "string";
    console.log("validTypes", validTypes);
    if (!validTypes) {
        return false;
    }

    // Validate addresses (must be 32-bytes long with 0x prefix)
    const validAddresses =
        content.nftContractAddress.startsWith("0x") &&
        content.nftContractAddress.length === 66 &&
        content.recipient.startsWith("0x") &&
        content.recipient.length === 66;
    console.log("validAddresses", validAddresses);
    return validAddresses;
}

export function getTransferError(content: any): string {
    if (!content) {
        return "Error: Missing transfer details";
    }

    if (!content.nftContractAddress) {
        return "Error: Contract address required";
    }

    if (!content.recipient) {
        return "Error: Recipient address required";
    }

    if (
        !content.nftContractAddress.startsWith("0x") ||
        content.nftContractAddress.length !== 66
    ) {
        return "Error: Invalid contract address";
    }

    if (
        !content.recipient.startsWith("0x") ||
        content.recipient.length !== 66
    ) {
        return "Error: Invalid recipient address";
    }

    return "";
}

export const getPercent = (amount: string | number, decimals: number) => {
    return new Percent(amount, decimals);
};

export const parseFormatedAmount = (amount: string) => amount.replace(/,/g, "");

export const PERCENTAGE_INPUT_PRECISION = 2;

export const parseFormatedPercentage = (percent: string) =>
    new Percent(
        +percent * 10 ** PERCENTAGE_INPUT_PRECISION,
        100 * 10 ** PERCENTAGE_INPUT_PRECISION
    );

interface ParseCurrencyAmountOptions {
    fixed: number;
    significant?: number;
}

export const formatCurrenyAmount = (
    amount: Fraction,
    { fixed, significant = 1 }: ParseCurrencyAmountOptions
) => {
    const fixedAmount = amount.toFixed(fixed);
    const significantAmount = amount.toSignificant(significant);

    if (+significantAmount > +fixedAmount) return significantAmount;
    else return +fixedAmount.toString();
};

export const formatPercentage = (percentage: Percent) => {
    const formatedPercentage = +percentage.toFixed(2);
    const exact = percentage.equalTo(
        new Percent(Math.round(formatedPercentage * 100), 10000)
    );

    return `${exact ? "" : "~"}${formatedPercentage}%`;
};

export type RetryConfig = {
    maxRetries?: number;
    delay?: number;
    maxDelay?: number;
    backoff?: (retryCount: number, delay: number, maxDelay: number) => number;
};

export async function fetchWithRetry<T>(
    url: string,
    options?: RequestInit,
    config: RetryConfig = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delay = 1000,
        maxDelay = 10000,
        backoff = (retryCount, baseDelay, maxDelay) =>
            Math.min(baseDelay * Math.pow(2, retryCount), maxDelay),
    } = config;

    let lastError: Error | null = null;

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(
                    `Coingecko API HTTP status: ${response.status}`
                );
            }

            return await response.json();
        } catch (error) {
            elizaLogger.debug(`Error fetching ${url}:`, error);
            lastError = error as Error;

            if (retryCount === maxRetries) break;

            await new Promise((resolve) =>
                setTimeout(resolve, backoff(retryCount, delay, maxDelay))
            );
            elizaLogger.debug(`Retry #${retryCount + 1} to fetch ${url}...`);
        }
    }

    throw lastError;
}
