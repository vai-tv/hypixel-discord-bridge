import { Bridge } from "../bridge/Bridge.js";

export class ChatHandler {
  private bridge: Bridge;
  private botUsernameGetter: () => string | undefined;

  private static readonly GUILD_CHAT_REGEX =
    /^Guild > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+)(?: \[(?<guildRank>\w+)\])?: (?<message>.+)$/;

  private static readonly OFFICER_CHAT_REGEX =
    /^Officer > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+): (?<message>.+)$/;

  private static readonly CHAT_ERRORS: Record<string, string> = {
    "Sending packets too fast!": "Sending packets too fast!",
    "You were spawned in Limbo.": "You were spawned in Limbo!",
  };

  constructor(bridge: Bridge, getBotUsername: () => string | undefined) {
    this.bridge = bridge;
    this.botUsernameGetter = getBotUsername;
  }

  public handleChat(rawMessage: string): void {
    // Strip Minecraft section symbol color/formatting codes and whitespace
    const cleanMessage = rawMessage.replace(/§[0-9a-fk-or]/gi, '').trim();

    // Skip blank packets
    if (!cleanMessage) return;

    // Emit raw server chat to Discord debug channel
    this.bridge.emitMinecraftChat({
      username: '',
      message: cleanMessage,
      channel: 'debug',
    });

    // Check for rate-limiting or server warnings
    const errorCheck = this.handleChatErrors(cleanMessage);
    if (errorCheck.success) {
      console.warn(`[MINECRAFT Warning] ${cleanMessage}`);
      return;
    }

    const currentBotUsername = this.botUsernameGetter()?.toLowerCase();

    // 1. Guild Chat Match
    const guildMatch = cleanMessage.match(ChatHandler.GUILD_CHAT_REGEX);
    if (guildMatch?.groups) {
      const { rank, username, message } = guildMatch.groups;
      if (!username || !message) return;
      if (username.toLowerCase() === currentBotUsername) return;

      this.bridge.emitMinecraftChat({
        username,
        message,
        rank: rank || '',
        channel: 'guild',
      });
      return;
    }

    // 2. Officer Chat Match
    const officerMatch = cleanMessage.match(ChatHandler.OFFICER_CHAT_REGEX);
    if (officerMatch?.groups) {
      const { rank, username, message } = officerMatch.groups;
      if (!username || !message) return;
      if (username.toLowerCase() === currentBotUsername) return;

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