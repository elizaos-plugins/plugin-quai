import type { Content, IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { Mnemonic, QuaiHDWallet, Wallet, parseUnits, JsonRpcProvider, type TransactionRequest, Zone } from "quais";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const WALLET_DIR = "./data";
const WALLET_FILE = path.join(WALLET_DIR, "quai_wallet.json");

export const getQuaiProvider = () => {
    return new JsonRpcProvider(
        'https://rpc.quai.network', undefined, { usePathing: true }
    );
};

// Load or generate wallet
const loadOrGenerateWallet = async (): Promise<Wallet> => {
    const provider = getQuaiProvider();

    try {
        // Check if wallet file exists
        const walletData = await fs.readFile(WALLET_FILE, "utf8");
        const { privateKey } = JSON.parse(walletData);
        // Validate private key (basic check)
        if (!privateKey || !privateKey.startsWith("0x") || privateKey.length !== 66) {
            throw new Error("Invalid private key format");
        }        
        const wallet = new Wallet(privateKey, provider);
        elizaLogger.log("Loaded existing Quai wallet:", { address: wallet.address });
        return wallet;
    } catch (error) {
        // If file doesn’t exist or is invalid, generate a new wallet
        elizaLogger.log("No existing wallet found or error loading. Generating new wallet... ", error);

        // Ensure the data directory exists
        await fs.mkdir(WALLET_DIR, { recursive: true });

        // Generate new mnemonic and wallet
        const entropy = crypto.randomBytes(16); // 12-word mnemonic
        const mnemonic = Mnemonic.fromEntropy(entropy);
        const hdWallet = QuaiHDWallet.fromMnemonic(mnemonic);
        const cyprus1Address = await hdWallet.getNextAddress(0, Zone.Cyprus1); // get the first address in the Cyrpus1 zone
        const key = hdWallet.getPrivateKey(cyprus1Address.address); // get the private key for the address in the Cyprus1 zone
        const wallet = new Wallet(key, provider);

        // Save to disk
        const walletData = JSON.stringify({
            privateKey: wallet.privateKey,
            address: wallet.address,
            createdAt: new Date().toISOString(),
        }, null, 2);
        await fs.writeFile(WALLET_FILE, walletData, "utf8");

        elizaLogger.log("Generated and saved new Quai wallet:", {
            address: wallet.address,
        });

        return wallet;
    }
};

// Initialize wallet (runs once when plugin loads)
const walletPromise = loadOrGenerateWallet();

export const validateSettings = (runtime: IAgentRuntime) => {
    const requiredSettings = [
        "QUAI_PRIVATE_KEY",
    ];

    for (const setting of requiredSettings) {
        if (!runtime.getSetting(setting)) {
            return false;
        }
    }

    return true;
};

export const getQuaiAccount = async () => {
    const account = await walletPromise;
    return account;
};

// Define transfer content interface for native QUAI
export interface TransferContent extends Content {
    recipient: string;
    amount: string | number;
}

// Validate transfer content
export function isTransferContent(
    content: unknown
): content is TransferContent {
    if (!content || typeof content !== 'object') {
        return false;
    }
    
    const contentObj = content as { recipient?: unknown; amount?: unknown };
    
    // Validate types
    const validTypes =
        typeof contentObj.recipient === "string" &&
        (typeof contentObj.amount === "string" ||
            typeof contentObj.amount === "number");
    if (!validTypes) {
        return false;
    }

    // Validate recipient address (20-bytes with 0x prefix)
    const recipient = contentObj.recipient as string;
    const validRecipient =
        recipient.startsWith("0x") &&
        recipient.length === 42;

    return validRecipient;
}