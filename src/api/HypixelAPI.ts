import { environment } from '../EnvHandler.js';
import { Client } from 'hypixel-api-reborn';
import type { Guild, Player } from 'hypixel-api-reborn';

export class HypixelAPI {
    public hypixel: Client;
    private apiKey: string;

    constructor() {
      this.apiKey = environment.minecraft.hypixelApiKey || '';
      if (!this.apiKey) throw new Error('Missing Hypixel API key in .env!');
      this.hypixel = new Client(this.apiKey, { cache: true });
    }

    public async getPlayer(username: string): Promise<{ player: Player, guild: Guild}  | null> {
        try {
            const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            if (!mojangRes.ok) return null;

            const player = await this.hypixel.getPlayer(username);
            if (!player) return null;
            
            const guild = await this.hypixel.getGuild("player", username);
            return { player, guild };

        } catch (error) {
            console.error(`[HypixelAPI] Error fetching player ${username}: ${error}`);
            return null;
        }
    }
}