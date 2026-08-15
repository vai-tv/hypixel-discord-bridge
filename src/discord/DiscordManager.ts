import { Client, GatewayIntentBits, TextChannel, WebhookClient } from "discord.js";
import { Bridge } from "../bridge/Bridge.js";
import type { ChatMessage, ChatChannel } from "../bridge/Bridge.js";
import { config } from "../config.js";

import { getUUID } from "../api/MojangAPI.js";

export class DiscordManager {
    private client: Client;
    private bridge: Bridge;
    private webhookClient: WebhookClient | null = null;

    constructor(bridge: Bridge) {
        this.bridge = bridge;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        if (config.discord.webhookUrl) {
            this.webhookClient = new WebhookClient({ url: config.discord.webhookUrl });
        }
    }

    public async connect(): Promise<void> {
        this.registerEvents();
        await this.client.login(process.env.DISCORD_TOKEN);
    }

    private registerEvents(): void {
        if (!this.client) return;

        this.client.on('ready', () => {
            console.log('[DISCORD] Bot is ready!');
        });

        // listen for discord -> minecraft messages
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || message.webhookId) return;

            let channelType: ChatChannel | null = null;

            if (message.channelId === process.env.DISCORD_GUILD_CHAT) {
                channelType = 'guild';
            } else if (message.channelId === process.env.DISCORD_OFFICER_CHAT) {
                channelType = 'officer';
            } else if (message.channelId === process.env.DISCORD_DEBUG_CHAT) {
                channelType = 'debug';
            }

            if (channelType) {
                this.bridge.emitDiscordChat({
                    username: message.author.displayName || message.author.username,
                    message: message.content,
                    channel: channelType
                });
            }
        });

        // listen for minecraft -> discord messages
        this.bridge.on('minecraftChat', async (data: ChatMessage) => {
            await this.handleMinecraftChat(data);
        });
    }

    private async handleMinecraftChat(data: ChatMessage): Promise<void> {
        const { username, message, rank, channel } = data;

        // debug channel
        if (channel === 'debug' ) {
            const debugChannel = await this.client.channels.fetch(process.env.DISCORD_DEBUG_CHAT || '') as TextChannel;
            if (debugChannel && debugChannel instanceof TextChannel) {
                debugChannel.send(`[DEBUG] ${username}: ${message}`);
            }
            return;
        }

        // determine target channel ID
        const targetChannelId = 
            channel === 'officer'
                ? process.env.DISCORD_OFFICER_CHAT
                : process.env.DISCORD_GUILD_CHAT;

        if (!targetChannelId) return;

        // fetch UUID for skin avatar
        const uuid = await getUUID(username);
        const avatarURL = uuid
        ? `https://crafatar.com/avatars/${uuid}?overlay=true`
        : `https://crafatar.com/avatars/steve?overlay=true`;

        const formattedUsername = rank && rank.length > 0 ? `${rank} ${username}` : username;

        // send message
        if (this.webhookClient) {
            this.webhookClient.send({
                content: message,
                username: formattedUsername,
                avatarURL
            });
        } else {
            const targetChannel = await this.client.channels.fetch(targetChannelId) as TextChannel;
            if (targetChannel && targetChannel instanceof TextChannel) {
                targetChannel.send(`**[${formattedUsername}]** ${message}`);
            }
        }
    }
}