import type { ChatChannel } from '../bridge/Bridge.js';

export interface MinecraftCommandContext {
  username: string;
  args: string[];
  channel: ChatChannel;
  reply: (message: string) => Promise<void> | void;
}

export abstract class MinecraftCommand {
  public abstract name: string;
  public abstract description: string;
  public abstract aliases: string[];

  public abstract execute(context: MinecraftCommandContext): Promise<void>;
}

export interface DiscordCommandContext {
    author: string,
    args: string[],
    channelId: string,
    reply: (message: string) => Promise<void>;
}

export abstract class DiscordCommand {
    public abstract name: string;
    public abstract description: string;
    
    public abstract execute(context: DiscordCommandContext): Promise<void>;
}