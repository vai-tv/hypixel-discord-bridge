import { Client, GatewayIntentBits, PermissionFlagsBits, TextChannel, WebhookClient } from "discord.js";
import { Bridge } from "../bridge/Bridge.js";
import type { ChatMessage, ChatChannel } from "../bridge/Bridge.js";
import { config } from "../config.js";

import { getUUID } from "../api/MojangAPI.js";

const REQUIRED_PERMISSIONS = [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.EmbedLinks
];

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

    public async connect(): Promise<boolean> {
        this.registerEvents();

        try {
            await this.client.login(config.discord.token);

            await new Promise<void>((resolve) => this.client.once('ready', () => resolve()));
            await this.verifyPermissions();

            return true;
        } catch (error: any) {
            this.handleError(error);
            return false;
        }
    }

    private handleError(error: any): void {
        // gateway error (disallowed bot intents)
        if (error.code === 4014 || error.message?.includes('disallowed intents')) {
            console.error(`[DISCORD] Your bot has disallowed intents! Switch on "Message Content Intent" under "Bot" in the Discord Developer Portal.`);
            process.exit(1);
        }
    }

    private registerEvents(): void {
        if (!this.client) return;

        this.client.on('ready', async () => {
            console.log(`[DISCORD] Logged in as ${this.client.user?.tag}!`);

            if (config.discord.guildServerId) {
                const guild = await this.client.guilds.fetch(config.discord.guildServerId).catch(() => null);
                if (guild) {
                console.log(`[DISCORD] Successfully found guild ${guild.name} (${guild.id})`);
                } else {
                console.warn(`[DISCORD] Could not get guild with ID ${config.discord.guildServerId}`);
                }
            }
            });

        // listen for discord -> minecraft messages
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || message.webhookId) return;

            let channelType: ChatChannel | null = null;

            if (message.channelId === config.discord.guildChatId) {
                channelType = 'guild';
            } else if (message.channelId === config.discord.officerChatId) {
                channelType = 'officer';
            } else if (message.channelId === config.discord.debugChatId) {
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

    private async verifyPermissions(): Promise<boolean> {
        if (!config.discord.guildServerId) return true;

        try {
            const guild = await this.client.guilds.fetch(config.discord.guildServerId);
            if (!guild) return false;

            const botMember = await guild.members.fetchMe();

            const missingPermissions: string[] = [];

            for (const perm of REQUIRED_PERMISSIONS) {
                if (!botMember.permissions.has(perm)) {
                    const permName = Object.keys(PermissionFlagsBits).find(key => (PermissionFlagsBits as any)[key] === perm);
                    if (permName) missingPermissions.push(permName || String(perm));
                }
            }

            if (missingPermissions.length > 0) {
                console.error('\n⚠️ [DISCORD Warning] MISSING REQUIRED BOT PERMISSIONS');
                console.error('─────────────────────────────────────────────────────────────');
                console.error(`The bot is missing the following permissions in "${guild.name}":`);
                missingPermissions.forEach((p) => console.error(` - ${p}`));
                console.error('\nSome features (like webhooks or reading chat) may fail.');
                console.error('You can use (this link)[https://discord.com/oauth2/authorize?client_id=1538229284512997558&permissions=536988672&integration_type=0&scope=bot] to add the bot to your server.');
                console.error('─────────────────────────────────────────────────────────────\n');
                return false;
            }

            console.log(`[DISCORD] Permissions verified successfully in "${guild.name}".`);
            return true;
            } catch (error) {
            console.warn('[DISCORD Warning] Could not verify permissions on startup:', error);
            return true;
        }
    }
}