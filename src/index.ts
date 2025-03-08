import type { Plugin } from "@elizaos/core";
import {sendQuaiAction, receiveQuaiAction} from "./actions/transfer";

export const quaiPlugin: Plugin = {
    name: "quai",
    description: "Quai Plugin for Eliza",
    actions: [sendQuaiAction, receiveQuaiAction],
    evaluators: [],
    providers: [],
};

export default quaiPlugin;
