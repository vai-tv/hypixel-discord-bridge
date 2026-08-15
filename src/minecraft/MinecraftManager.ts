import mineflayer from 'mineflayer';
import path from 'path';
import type { Bot } from 'mineflayer';
import { Bridge } from '../bridge/Bridge.js';
import type { DiscordChatMessage } from '../bridge/Bridge.js';
import config from '../../config.json' with { type: "json" };
import { setTimeout } from 'node:timers/promises';

export class MinecraftManager {
  public bot: Bot | null = null;
  private bridge: Bridge;
  private messageQueue: string[] = [];
  private isProcessingQueue = false;
  private readonly MESSAGE_DELAY_MS = 1200;

  constructor(bridge: Bridge) {
    this.bridge = bridge;
  }

  public send(message: string): void {
    const cleanMessage = message.replace(/[\r\n]+/g, ' ').trim();
    if (!cleanMessage) return;

    this.messageQueue.push(cleanMessage);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.bot) return;

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.bot) {
        // Direct Mineflayer execution (prevents recursive queue loop)
        this.bot.chat(message);
        await setTimeout(this.MESSAGE_DELAY_MS);
      }
    }

    this.isProcessingQueue = false;
  }

  public connect(): void {
    this.bot = mineflayer.createBot({
      host: 'mc.hypixel.net',
      port: 25565,
      version: '1.8.9',
      auth: 'microsoft',
      username: config.bot.username,
      profilesFolder: path.join(process.cwd(), '.cache', 'mc-auth')
    });

    this.registerEvents();
  }

  private registerEvents(): void {
    if (!this.bot) return;

    this.bot.on('login', () => {
      console.log(`[MINECRAFT] ${this.bot?.username} joined Hypixel!`);
    });

    this.bot.on('kicked', (extra) => {
      console.warn(`[MINECRAFT Warning] Kicked: ${extra}`);
    });

    this.bot.on('end', async (extra) => {
      console.warn(`[MINECRAFT Warning] Disconnected: ${extra}`);
      const reconnect = config.bot.reconnect;

      if (reconnect) {
        let reconnectDelay = reconnect.delay;
        for (let i = 0; i < reconnect.max; i++) {
          console.log(`[MINECRAFT] Reconnecting in ${(reconnectDelay / 1000).toFixed(1)}s... (${i + 1}/${reconnect.max})`);
          await setTimeout(reconnectDelay);
          this.connect();
          reconnectDelay *= 1.3;
        }
      }
    });

    // listen to messages from hypixel
    this.bot.on('message', (jsonMessage) => {
        const message = jsonMessage.toString();
        this.handleChat(message);
    });

    // listen for incoming discord messages to forward to minecraft
    this.bridge.on('discordChat', (data: DiscordChatMessage) => {
      if (!this.bot) return;

      // ignore self-echoes if the message username matches the bot's username
      if (data.username.toLowerCase() === this.bot.username.toLowerCase()) return;

      if (data.channel === 'guild') {
        this.send(`/gc ${data.username}: ${data.message}`);
      } else if (data.channel === 'officer') {
        this.send(`/oc ${data.username}: ${data.message}`);
      } else if (data.channel === 'debug') {
        // Direct command injection from Discord Debug channel
        this.send(data.message);
      }
    });
  }

  private handleChat(rawmessage: string): void {
    // emit all raw server text directly to debug
    this.bridge.emitMinecraftChat({
      username: '',
      message: rawmessage,
      channel: 'debug',
    });

    if (this.handleChatErrors(rawmessage).success) {
      console.warn(`[MINECRAFT Warning] ${rawmessage}`);
      return;
    }

    // regex for guild and officer chats on hypixel
    const guildChatRegex = /^Guild > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+)(?: \[(?<guildRank>\w+)\])?: (?<message>.+)$/;
    const officerChatRegex = /^Officer > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+): (?<message>.+)$/;

    const guildMatch = rawmessage.match(guildChatRegex);
    const officerMatch = rawmessage.match(officerChatRegex);

    if (guildMatch?.groups) {
      const { rank, username, message } = guildMatch.groups;
      if (!username || !message) return;
      if (username.toLowerCase() === this.bot?.username.toLowerCase()) return;

      this.bridge.emitMinecraftChat({
        username,
        message,
        rank: rank || '',
        channel: 'guild',
      });
    } else if (officerMatch?.groups) {
      const { rank, username, message } = officerMatch.groups;
      if (!username || !message) return;
      if (username.toLowerCase() === this.bot?.username.toLowerCase()) return;

      this.bridge.emitMinecraftChat({
        username,
        message,
        rank: rank || '',
        channel: 'officer',
      });
    }
  }

  private handleChatErrors(message: string): { success: boolean; message: string } {
    const ChatErrors: Record<string, string> = {
      "Sending packets too fast!": "Sending packets too fast!",
      "You were spawned in Limbo.": "You were spawned in Limbo!",
    };

    for (const [key, value] of Object.entries(ChatErrors)) {
      if (message.includes(key)) {
        return { success: true, message: value };
      }
    }

    return { success: false, message: '' };
  }
}