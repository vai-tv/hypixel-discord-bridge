import { EventEmitter } from 'events';
import { replaceVariables } from '../utils/HelperFunctions.js';

import messages from '../../messages.json' with { type: "json" };

export type ChatChannel = 'guild' | 'officer' | 'debug';

export interface MinecraftChatMessage {
    username: string;
    message: string;
    rank?: string;
    channel: ChatChannel;
    [key: string]: unknown;
}

export interface DiscordChatMessage {
    id: string;
    username: string;
    message: string;
    channel: ChatChannel;
    [key: string]: unknown;
}

export class Bridge extends EventEmitter {
    constructor() {
        super();
    }

    public emitMinecraftChat(data: MinecraftChatMessage): void {
        if (data.channel !== 'debug') {
            console.log(replaceVariables(messages.logs.chat.discordemit, data));
        }
        this.emit('minecraftChat', data);
    }

    public emitDiscordChat(data: DiscordChatMessage): void {
        console.log(replaceVariables(messages.logs.chat.minecraftemit, data));
        this.emit('discordChat', data);
    }

    public emitDiscordChatAck(messageId: string): void {
        this.emit('discordChatAck', messageId);
    }
}