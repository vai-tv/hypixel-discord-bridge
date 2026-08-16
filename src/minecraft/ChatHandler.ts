import { Bridge } from "../bridge/Bridge.js";
import { MinecraftCommandHandler } from "./CommandHandler.js";

export class ChatHandler {
    private bridge: Bridge;
    private botUsernameGetter: () => string | undefined;
    private commandHandler: MinecraftCommandHandler;

    private static readonly GUILD_CHAT_REGEX =
        /^Guild > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+)(?: \[(?<guildRank>\w+)\])?: (?<message>.+)$/;

    private static readonly OFFICER_CHAT_REGEX =
        /^Officer > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+)(?: \[(?<guildRank>\w+)\])?: (?<message>.+)$/;

    private static readonly CHAT_ERRORS: Record<string, string> = {
        "Sending packets too fast!": "Sending packets too fast!",
        "You were spawned in Limbo.": "You were spawned in Limbo!",
        "You are AFK.": "You were timed out in Limbo for being AFK!",
    };

    constructor(bridge: Bridge, commandHandler: MinecraftCommandHandler, getBotUsername: () => string | undefined) {
        this.bridge = bridge;
        this.botUsernameGetter = getBotUsername;
        this.commandHandler = commandHandler;
    }

    public async handleChat(rawMessage: string): Promise<void> {
        const cleanMessage = rawMessage.replace(/§[0-9a-fk-or]/gi, '').trim();
        if (!cleanMessage) return;

        // emit raw to debug
        this.bridge.emitMinecraftChat({
            username: '',
            message: cleanMessage,
            channel: 'debug',
        });

        // error check
        const errorCheck = this.handleChatErrors(cleanMessage);
        if (errorCheck.success) {
            console.warn(`[MINECRAFT Warning] ${cleanMessage}`);
            return;
        }

        const currentBotUsername = this.botUsernameGetter()?.toLowerCase();

        const guildMatch = cleanMessage.match(ChatHandler.GUILD_CHAT_REGEX);
        if (guildMatch?.groups) {
            const { rank, username, message } = guildMatch.groups;
            if (!username || !message) return;

            const isBot = username.toLowerCase() === currentBotUsername;
            if (isBot) return;

            await this.commandHandler.handleMessage(username, message, 'guild');

            this.bridge.emitMinecraftChat({
                username,
                message,
                rank: rank || '',
                channel: 'guild',
            });
            return;
        }

        const officerMatch = cleanMessage.match(ChatHandler.OFFICER_CHAT_REGEX);
        if (officerMatch?.groups) {
            const { rank, username, message } = officerMatch.groups;
            if (!username || !message) return;

            const isBot = username.toLowerCase() === currentBotUsername;
            if (isBot) return;
            
            await this.commandHandler.handleMessage(username, message, 'officer');

            this.bridge.emitMinecraftChat({
                username,
                message,
                rank: rank || '',
                channel: 'officer',
            });
        }
    }

    private handleChatErrors(message: string): { success: boolean; message: string } {
        for (const [key, value] of Object.entries(ChatHandler.CHAT_ERRORS)) {
            if (message.includes(key)) {
                return { success: true, message: value };
            }
        }
        return { success: false, message: '' };
    }
}