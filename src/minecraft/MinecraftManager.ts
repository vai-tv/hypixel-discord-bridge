import mineflayer from 'mineflayer';
import type { Bot } from 'mineflayer';
import { Bridge } from '../bridge/Bridge.js';
import type { ChatMessage } from '../bridge/Bridge.js';

export class MinecraftManager {
  private bot: Bot | null = null;
  private bridge: Bridge;

  constructor(bridge: Bridge) {
    this.bridge = bridge;
  }

  public connect(): void {
    this.bot = mineflayer.createBot({
      host: 'mc.hypixel.net',
      port: 25565,
      version: '1.8.9',
      auth: (process.env.MC_AUTH as 'microsoft') || 'microsoft',
      username: process.env.MC_EMAIL || ''
    });

    this.registerEvents();
  }

    private registerEvents(): void {
        if (!this.bot) return;

        this.bot.on('spawn' , () => {
            console.log('[MINECRAFT] Bot spawned on Hypixel!');
        });

        // listen to messages from hypixel
        this.bot.on('message', (jsonMessage) => {
            const message = jsonMessage.toString();
            this.handleChat(message);
        });

        // listen to messages from discord to send to hypixel
        this.bridge.on('discordChat', (data: ChatMessage) => {
            if (!this.bot) return;

            if (data.channel === 'guild') {
                this.bot.chat(`/gc ${data.rank} ${data.username}: ${data.message}`);
            } else if (data.channel === 'officer') {
                this.bot.chat(`/oc ${data.username}: ${data.message}`);
            } else if (data.channel === 'debug') {
                this.bot.chat(`${data.message}`);
            }
        });
    }

    private handleChat(rawmessage: string): void {

        // always send every raw line seen by the bot to the Debug Channel
        this.bridge.emitMinecraftChat({
            username: 'SYSTEM',
            message: rawmessage,
            channel: 'debug',
        });

        // check if the message is a guild chat message
        const guildChatRegex = /^Guild > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+)(?: \[(?<guildRank>\w+)\])?: (?<message>.+)$/;
        const officerChatRegex = /^Officer > (?:\[(?<rank>[A-Z\+]+)\] )?(?<username>\w+): (?<message>.+)$/;
        
        const guildMatch = rawmessage.match(guildChatRegex);
        const officerMatch = rawmessage.match(officerChatRegex);

        if (guildMatch?.groups) {
            const { rank, username, message } = guildMatch.groups;

            if (!username || !message) return;
            if (username.toLowerCase() === this.bot?.username.toLowerCase()) return;

            this.bridge.emitMinecraftChat({
                username: username,
                message: message,
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
}