import { Client, GatewayIntentBits, PermissionFlagsBits, TextChannel, WebhookClient } from "discord.js";
import { Bridge } from "../bridge/Bridge.js";
import type { MinecraftChatMessage, ChatChannel } from "../bridge/Bridge.js";
import { environment } from "../EnvHandler.js";
import config from '../../config.json' with { type: "json" };
import { getUUID } from "../api/MojangAPI.js";

const REQUIRED_PERMISSIONS = [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.EmbedLinks
];

function prepareMessage(rawMessage: string): string {
    const formatted = rawMessage.replace(/§([0-9a-fk-or])/gi, '&$1');
    return formatted.replace(/([\\*_`~>|#@\-])/g, '\\$1').trim();
}

export class DiscordManager {
    private client: Client;
    private bridge: Bridge;
    private guildWebhook: WebhookClient | null = null;
    private officerWebhook: WebhookClient | null = null;

    constructor(bridge: Bridge) {
        this.bridge = bridge;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        if (config.bot.useWebhooks) {
            if (environment.discord.guildWebhookUrl?.trim()) {
                this.guildWebhook = new WebhookClient({ url: environment.discord.guildWebhookUrl });
            }
            if (environment.discord.officerWebhookUrl?.trim()) {
                this.officerWebhook = new WebhookClient({ url: environment.discord.officerWebhookUrl });
            }
        }
    }

    public async connect(): Promise<boolean> {
        this.registerEvents();

        try {
            await this.client.login(environment.discord.token);
            await new Promise<void>((resolve) => this.client.once('ready', () => resolve()));
            await this.verifyPermissions();
            return true;
        } catch (error: any) {
            this.handleError(error);
            return false;
        }
    }

    private handleError(error: any): void {
        if (error.code === 4014 || error.message?.includes('disallowed intents')) {
            console.error(`[DISCORD] Disallowed intents! Enable "Message Content Intent" in Discord Developer Portal.`);
            process.exit(1);
        }

        console.error(`[DISCORD] Error: ${error}`);
    }

    private registerEvents(): void {
        if (!this.client) return;

        this.client.on('ready', async () => {
            console.log(`[DISCORD] Logged in as ${this.client.user?.tag}!`);

            if (environment.discord.guildServerId) {
                const guild = await this.client.guilds.fetch(environment.discord.guildServerId).catch(() => null);
                if (guild) {
                console.log(`[DISCORD] Successfully found guild ${guild.name} (${guild.id})`);
                } else {
                console.warn(`[DISCORD] Could not get guild with ID ${environment.discord.guildServerId}`);
                }
            }
        });

        this.client.on('error', (error) => {
            this.handleError(error);
        });

        // Discord -> Minecraft
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || message.webhookId) return;

            let channelType: ChatChannel | null = null;

            if (message.channelId === environment.discord.guildChatId) channelType = 'guild';
            else if (message.channelId === environment.discord.officerChatId) channelType = 'officer';
            else if (message.channelId === environment.discord.debugChatId) channelType = 'debug';

            if (channelType) {
                const messageId = message.id;

                // 5 second timeout
                const timeout = setTimeout(async () => {
                    this.bridge.off('discordChatAck', ackHandler);
                    await message.react('❌').catch(() => null);
                }, 5000);

                const ackHandler = (ackId: string) => {
                    if (ackId !== messageId) return;
                    clearTimeout(timeout);
                    this.bridge.off('discordChatAck', ackHandler);
                };

                this.bridge.on('discordChatAck', ackHandler);

                console.log(`[DISCORD -> MC] (${channelType}): ${message.content}`);
                this.bridge.emitDiscordChat({
                    id: messageId,
                    username: message.author.displayName || message.author.username,
                    message: message.content,
                    channel: channelType
                });
            }
        });

        // Minecraft -> Discord
        this.bridge.on('minecraftChat', async (message: MinecraftChatMessage) => {
            if (message.channel !== 'debug') {
                console.log(`[MC -> DISCORD ${message.channel}] (${message.username}): ${message.message}`);
            }
            await this.handleMinecraftChat(message);
        });
    }

    private async handleMinecraftChat(data: MinecraftChatMessage): Promise<void> {
        const { username, message, rank, channel } = data;

        const cleanMessage = prepareMessage(message);
        if (!cleanMessage) return;

        // debug channel
        if (channel === 'debug') {
            if (!environment.discord.debugChatId) return;
            const debugChannel = await this.client.channels.fetch(environment.discord.debugChatId).catch(() => null);
            if (debugChannel && debugChannel instanceof TextChannel) {
                debugChannel.send(cleanMessage);
            }
            return;
        }

        // select target destination ID & webhook
        const targetChannelId = channel === 'officer'
            ? environment.discord.officerChatId
            : environment.discord.guildChatId;

        const webhook = channel === 'officer' ? this.officerWebhook : this.guildWebhook;

        if (!targetChannelId) return;

        // fetch avatar skin
        const uuid = username ? await getUUID(username) : null;
        const avatarURL = uuid
            ? `https://crafatar.com/avatars/${uuid}?overlay=true`
            : `https://crafatar.com/avatars/steve?overlay=true`;

        const formattedUsername = rank && rank.length > 0 ? `[${rank}] ${username}` : username;

        // send via webhook if available, fallback to text channel
        if (config.bot.useWebhooks && webhook) {
            await webhook.send({
                content: cleanMessage,
                username: formattedUsername || 'Hypixel Bot',
                avatarURL
            }).catch(console.error);
        } else {
            const targetChannel = await this.client.channels.fetch(targetChannelId).catch(() => null);
            if (targetChannel && targetChannel instanceof TextChannel) {
                await targetChannel.send(`**${formattedUsername}**: ${cleanMessage}`).catch(console.error);
            }
        }
    }

    private async verifyPermissions(): Promise<boolean> {
        if (!environment.discord.guildServerId) return true;

        try {
            const guild = await this.client.guilds.fetch(environment.discord.guildServerId);
            if (!guild) return false;

            const botMember = await guild.members.fetchMe();
            const missingPermissions: string[] = [];

            for (const perm of REQUIRED_PERMISSIONS) {
                if (!botMember.permissions.has(perm)) {
                    const permName = Object.keys(PermissionFlagsBits).find(key => (PermissionFlagsBits as any)[key] === perm);
                    if (permName) missingPermissions.push(permName);
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

            console.log(`[DISCORD] Permissions okay.`);
            return true;
            } catch (error) {
            console.warn('[DISCORD Warning] Could not verify permissions on startup:', error);
            return true;
        }
    }
}