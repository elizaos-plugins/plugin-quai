// src/actions/transfer.ts
import {
  ModelClass,
  composeContext,
  generateObject
} from "@elizaos/core";

// src/utils/index.ts
import { JsonRpcProvider, Wallet } from "quais";
var validateSettings = (runtime) => {
  const requiredSettings = [
    "QUAI_PRIVATE_KEY",
    "QUAI_RPC_URL"
  ];
  for (const setting of requiredSettings) {
    if (!runtime.getSetting(setting)) {
      return false;
    }
  }
  return true;
};
var getQuaiProvider = (runtime) => {
  return new JsonRpcProvider(
    runtime.getSetting("QUAI_RPC_URL")
  );
};
var getQuaiAccount = (runtime) => {
  const provider = getQuaiProvider(runtime);
  const account = new Wallet(runtime.getSetting("QUAI_PRIVATE_KEY"), provider);
  return account;
};
function isTransferContent(content) {
  const validTypes = (content.tokenAddress === null || typeof content.tokenAddress === "string") && typeof content.recipient === "string" && (typeof content.amount === "string" || typeof content.amount === "number");
  if (!validTypes) {
    return false;
  }
  const validRecipient = content.recipient.startsWith("0x") && content.recipient.length === 42;
  const validTokenAddress = content.tokenAddress === null || content.tokenAddress.startsWith("0x") && content.tokenAddress.length === 42;
  return validRecipient && validTokenAddress;
}

// src/actions/transfer.ts
import { formatUnits } from "quais";
var transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenAddress": "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    "recipient": "0x0005C06bD1339c79700a8DAb35DE0a1b61dFBD71",
    "amount": "0.001"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token transfer:
- Token contract address (if available)
- Recipient wallet address
- Amount to send

Respond with a JSON markdown block containing only the extracted values.`;
var transfer_default = {
  name: "SEND_TOKEN",
  similes: [
    "TRANSFER_TOKEN_ON_QUAI",
    "TRANSFER_TOKENS_ON_QUAI",
    "SEND_TOKENS_ON_QUAI",
    "SEND_QUAI",
    "PAY_ON_QUAI"
  ],
  validate: async (runtime, message) => {
    return validateSettings(runtime);
  },
  description: "MUST use this action if the user requests send a token or transfer a token, the request might be varied, but it will always be a token transfer. If the user requests a transfer of lords, use this action.",
  handler: async (runtime, message, state, _options, callback) => {
    console.log("Starting TRANSFER_TOKEN handler...");
    if (!state) {
      state = await runtime.composeState(message);
    } else {
      state = await runtime.updateRecentMessageState(state);
    }
    const transferContext = composeContext({
      state,
      template: transferTemplate
    });
    const content = await generateObject({
      runtime,
      context: transferContext,
      modelClass: ModelClass.MEDIUM
    });
    console.log("Transfer content:", content);
    if (!isTransferContent(content)) {
      console.error("Invalid content for TRANSFER_TOKEN action.");
      if (callback) {
        callback({
          text: "Not enough information to transfer tokens. Please respond with token address, recipient, and amount.",
          content: { error: "Invalid transfer content" }
        });
      }
      return false;
    }
    try {
      const account = getQuaiAccount(runtime);
      const amount = formatUnits(content.amount, "wei");
      var txObj = {};
      if (content.tokenAddress) {
      } else {
        txObj = {
          to: content.recipient,
          value: amount,
          from: account.address
        };
        console.log(
          "Transferring",
          amount,
          "QUAI",
          "to",
          content.recipient
        );
      }
      const tx = await account.sendTransaction(txObj);
      console.log(
        "Transfer completed successfully! tx: " + tx.hash
      );
      if (callback) {
        callback({
          text: "Transfer completed successfully! tx: " + tx.hash,
          content: {}
        });
      }
      return true;
    } catch (error) {
      console.error("Error during token transfer:", error);
      if (callback) {
        callback({
          text: `Error transferring tokens: ${error.message}`,
          content: { error: error.message }
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
          text: "Send 10 QUAI to 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll transfer 10 QUAI to that address right away. Let me process that for you."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Please send 0.5 QUAI to 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "Got it, initiating transfer of 0.5 QUAI to the provided address. I'll confirm once it's complete."
        }
      }
    ]
  ]
};

// src/index.ts
var quaiPlugin = {
  name: "quai",
  description: "Quai Plugin for Eliza",
  actions: [transfer_default],
  evaluators: [],
  providers: []
};
var index_default = quaiPlugin;
export {
  index_default as default,
  quaiPlugin
};
//# sourceMappingURL=index.js.map