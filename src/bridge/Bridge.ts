import { EventEmitter } from 'events';

export type ChatChannel = 'guild' | 'officer' | 'debug';

export interface ChatMessage {
  username: string;
  message: string;
  rank?: string;
  channel: ChatChannel;
}

export class Bridge extends EventEmitter {
  constructor() {
    super();
  }

  public emitMinecraftChat(data: ChatMessage): void {
    this.emit('minecraftChat', data);
  }

  public emitDiscordChat(data: ChatMessage): void {
    this.emit('discordChat', data);
  }
}