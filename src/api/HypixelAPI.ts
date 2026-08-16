import { environment } from '../EnvHandler.js';
import { Client, Player } from 'hypixel-api-reborn';

export class HypixelAPI {
    private hypixel: Client;
    private apiKey: string;

    constructor() {
      this.apiKey = environment.minecraft.hypixelApiKey || '';
      if (!this.apiKey) throw new Error('Missing Hypixel API key in .env!');
      this.hypixel = new Client(this.apiKey);
    }

    public async getPlayer(username: string): Promise<Player | null> {
        try {
            const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            if (!mojangRes.ok) return null;

            const player = await this.hypixel.getPlayer(username);
            if (!player) return null;
            return player;
        } catch (error) {
            console.error(`[HypixelAPI] Error fetching player ${username}: ${error}`);
            return null;
        }
    }
}