import axios from 'axios';

const uuidCache: Map<string, string> = new Map();

export async function getUUID(username: string): Promise<string | null> {
    if (uuidCache.has(username.toLowerCase())) {
      return uuidCache.get(username.toLowerCase())!;
    }

    try {
      const response = await axios.get(
        `https://api.mojang.com/users/profiles/minecraft/${username}`
      );
      if (response.data && response.data.id) {
        uuidCache.set(username.toLowerCase(), response.data.id);
        return response.data.id;
      }
    } catch {
      // Return null on API failure (falls back to default Steve skin)
    }
    return null;
}