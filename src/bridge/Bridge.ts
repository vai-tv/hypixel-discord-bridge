import { EventEmitter } from 'events';

export type ChatChannel = 'guild' | 'officer' | 'debug';

export interface MinecraftChatMessage {
  username: string;
  message: string;
  rank?: string;
  channel: ChatChannel;
}

export interface DiscordChatMessage {
  username: string;
  message: string;
  channel: ChatChannel;
}

export class Bridge extends EventEmitter {
  constructor() {
    super();
  }

  public emitMinecraftChat(data: MinecraftChatMessage): void {
    this.emit('minecraftChat', data);
  }

  public emitDiscordChat(data: DiscordChatMessage): void {
    this.emit('discordChat', data);
  }
}