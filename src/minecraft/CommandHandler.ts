import type { Bot } from 'mineflayer';
import { MinecraftCommand } from "../contracts/Command.js";
import type { ChatChannel } from "../bridge/Bridge.js";

import config from '../../config.json' with { type: "json" };

export class MinecraftCommandHandler {
    private commands = new Map<string, MinecraftCommand>();
    private bot: Bot;
    private prefix = config.bot.prefix;

    constructor(bot: Bot) {
        this.bot = bot;
    }
    
    public registerCommand(command: MinecraftCommand) {
        this.commands.set(command.name.toLowerCase(), command);
        command.aliases.forEach(alias => this.commands.set(alias.toLowerCase(), command));
    }

    public async handleMessage(username: string, message: string, channel: ChatChannel): Promise<boolean> {
    if (!message.startsWith(this.prefix)) return false;

    const args = message.slice(this.prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName || !this.commands.has(commandName)) return false;

    const command = this.commands.get(commandName)!;

    // helper to send the output straight back to Hypixel chat
    const reply = (response: string) => {
      const cleanMsg = response.replace(/\r?\n|\r/g, ' ');
      if (channel === 'guild') {
        this.bot.chat(`/gc ${cleanMsg}`);
      } else if (channel === 'officer') {
        this.bot.chat(`/oc ${cleanMsg}`);
      } else if (channel === 'debug') {
        this.bot.chat(cleanMsg);
      }
    };

    try {
      await command.execute({
        username,
        args,
        channel,
        reply,
      });
    } catch (err) {
      console.error(`[MinecraftCommandHandler] Error running ${commandName}:`, err);
      reply(`Error executing command: ${commandName}`);
    }

    return true;
  }
}