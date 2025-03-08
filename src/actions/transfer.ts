import {
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type Action,
    composeContext,
    generateObject,
    elizaLogger,
} from "@elizaos/core";
import {
    getQuaiAccount,
    isTransferContent,
    validateSettings,
} from "../utils";
import { getAddress, isQuaiAddress, parseUnits, TransactionReceipt, type TransactionRequest } from "quais";
elizaLogger.debug("Loaded Quai plugin actions.");
const transferTemplate = `Respond with a JSON markdown block containing only the extracted values.

Example response:
\`\`\`json
{
    "recipient": "0x0005C06bD1339c79700a8DAb35DE0a1b61dFBD71",
    "amount": "0.001"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested QUAI transfer:
- Recipient wallet address
- Amount to send in QUAI

Respond with a JSON markdown block containing only the extracted values.`;

// Action definition
export const sendQuaiAction: Action = {
    name: "SEND_QUAI",
    similes: [
        "TRANSFER_QUAI",              // Existing: General transfer intent
        "SEND_NATIVE_QUAI",           // Existing: Native Quai specificity
        "PAY_WITH_QUAI",              // Existing: Payment connotation
        "SEND_QUAI_FROM_AGENT",       // Clarifies agent as sender
        "TRANSFER_QUAI_TO_ADDRESS",   // Emphasizes destination
        "GIVE_QUAI_TO_RECIPIENT",     // Casual giving intent
        "MOVE_QUAI_TO_WALLET",        // Movement phrasing
        "DISPATCH_QUAI",              // Dispatch/send intent
        "FORWARD_QUAI",               // Forwarding connotation
        "SEND_QUAI_PAYMENT",          // Payment-specific sending
        "TRANSFER_CRYPTO_QUAI",       // Broader crypto context
        "EXECUTE_QUAI_TRANSFER",      // Formal execution intent
        "SEND_QUAI_TO_USER",          // User-specific sending
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return validateSettings(runtime);
    },
    description: "MUST use this action if the user requests the agent to send or transfer native QUAI to a specified address.",    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_QUAI handler...");

        // Initialize or update state
        const currentState = !state 
            ? await runtime.composeState(message) 
            : await runtime.updateRecentMessageState(state);

        // Compose transfer context
        const transferContext = composeContext({
            state: currentState,
            template: transferTemplate,
        });

        // Generate transfer content
        const content = await generateObject({
            runtime,
            context: transferContext,
            modelClass: ModelClass.MEDIUM,
        });

        elizaLogger.debug("Transfer content:", content);

        // Validate transfer content
        if (!isTransferContent(content)) {
            elizaLogger.error("Invalid content for SEND_QUAI action.");
            if (callback) {
                callback({
                    text: "Not enough information to transfer QUAI. Please provide recipient and amount.",
                    content: { error: "Invalid transfer content" },
                });
            }
            return false;
        }

        try {
            const account = await getQuaiAccount();
            const amountInWei = parseUnits(content.amount.toString(), 18);
            if(getAddress(content.recipient) === null || isQuaiAddress(getAddress(content.recipient)) === false) {
                elizaLogger.error("Invalid recipient address: ", content.recipient);
                if (callback) {
                    callback({
                        text: `Invalid recipient address: ${content.recipient}`,
                        content: { error: "Invalid recipient address" },
                    });
                }
            }
            const txObj: TransactionRequest = {
                to: getAddress(content.recipient),
                value: amountInWei,
                from: account.address,
            };

            elizaLogger.log(
                "Transferring",
                content.amount,
                "QUAI",
                "to",
                content.recipient
            );

            const tx = await account.sendTransaction(txObj);
            const receipt = await tx.wait();

            if ("status" in receipt && receipt.status === 1) {
                elizaLogger.success(`Transfer completed successfully! tx: ${tx.hash}`);
                if (callback) {
                    callback({
                        text: `Transfer completed successfully! tx: ${tx.hash}`,
                        content: {},
                    });
                }
                return true;
            } else {
                elizaLogger.error("Transaction failed:", receipt);
                if (callback) {
                    callback({
                        text: `Transfer failed. Transaction hash: ${tx.hash}`,
                        content: { error: "Transaction failed" },
                    });
                }
                return false;
            }
        } catch (error) {
            elizaLogger.error("Error during QUAI transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring QUAI: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            { user: "{{user1}}", content: { text: "Send 10 QUAI to 0x009d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" } },
            { user: "{{agent}}", content: { text: "transferring 10 quai to that address now. hold tight." } },
        ],
        [
            { user: "{{user1}}", content: { text: "Please send 0.5 QUAI to 0x00fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac" } },
            { user: "{{agent}}", content: { text: "got it. sending 0.5 quai to that address. will confirm when it’s done." } },
        ],
        [
            { user: "{{user2}}", content: { text: "Transfer 2 QUAI to 0x0034..." } },
            { user: "{{agent}}", content: { text: "moving 2 quai to 0x0034... as we speak." } },
        ],
        [
            { user: "{{user3}}", content: { text: "Pay 1 QUAI to 0x0078..." } },
            { user: "{{agent}}", content: { text: "paying 1 quai to 0x0078... let’s make it happen." } },
        ],
        [
            { user: "{{user4}}", content: { text: "Give 5 QUAI to 0x00bc..." } },
            { user: "{{agent}}", content: { text: "handing over 5 quai to 0x00bc... consider it done." } },
        ],
        [
            { user: "{{user5}}", content: { text: "Send 0.1 QUAI to my friend at 0x00f0..." } },
            { user: "{{agent}}", content: { text: "sending 0.1 quai to your friend’s wallet at 0x00f0... should be there soon." } },
        ],
        [
            { user: "{{user6}}", content: { text: "Move 3 QUAI to 0x00ed..." } },
            { user: "{{agent}}", content: { text: "shifting 3 quai to 0x00ed... on its way." } },
        ],
    ] as ActionExample[][],
} as Action;

export const receiveQuaiAction: Action = {
    name: "RECEIVE_QUAI",
    similes: [
        "SEND_QUAI_TO_AGENT",         // Existing: Direct sending to agent
        "TRANSFER_QUAI_TO_AGENT",     // Existing: Transfer phrasing
        "GIVE_QUAI_TO_AGENT",         // Existing: Giving connotation
        "SEND_QUAI_TO_ME",            // Matches "send Quai to me" flipped
        "PROVIDE_QUAI_ADDRESS",       // Intent to get address for sending
        "RECEIVE_QUAI_FROM_USER",     // Reverse perspective
        "SHARE_QUAI_WALLET",          // Sharing wallet for receiving
        "ACCEPT_QUAI_PAYMENT",        // Accepting Quai
        "GET_QUAI_FROM_YOU",          // User offering Quai
        "DEPOSIT_QUAI_TO_AGENT",      // Depositing to agent
        "QUAI_TO_AGENT_WALLET",       // Broad Quai-to-agent intent
        "SEND_CRYPTO_TO_AGENT",       // Broader crypto context
        "I_WANT_TO_SEND_QUAI",        // Matches your exact input intent
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return validateSettings(runtime);
    },
    description: "Triggers when the user wants to send Quai to the agent or requests the agent's Quai wallet address.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting RECEIVE_QUAI handler...");

        try {
            const account = await getQuaiAccount();
            const agentAddress = account.address;

            if (callback) {
                callback({
                    text: `To send Quai to me, please use the following address: ${agentAddress}. Make sure to double-check the address before sending.`,
                    content: { address: agentAddress },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in RECEIVE_QUAI action:", error);
            if (callback) {
                callback({
                    text: "There was an error retrieving my address. Please try again later.",
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
                content: { text: "I want to send you some Quai. What's your address?" },
            },
            {
                user: "{{agent}}",
                content: { text: "to send me quai, use this address: 0xAgentAddressHere" },
            },
        ],
        [
            {
                user: "{{user2}}",
                content: { text: "Can I send you Quai? Please provide your address." },
            },
            {
                user: "{{agent}}",
                content: { text: "to send me quai, use this address: 0xAgentAddressHere" },
            },
        ],
        [
            {
                user: "{{user3}}",
                content: { text: "I would like to send you QUAI" },
            },
            {
                user: "{{agent}}",
                content: { text: "to send me quai, use this address: 0xAgentAddressHere" },
            },
        ],
        [
            {
                user: "{{user4}}",
                content: { text: "Send you QUAI" },
            },
            {
                user: "{{agent}}",
                content: { text: "to send me quai, use this address: 0xAgentAddressHere" },
            },
        ],
        [
            {
                user: "{{user5}}",
                content: { text: "What’s your QUAI address?" },
            },
            {
                user: "{{agent}}",
                content: { text: "to send me quai, use this address: 0xAgentAddressHere" },
            },
        ],
    ] as ActionExample[][],
};