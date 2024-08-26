import { ShardState } from "discordeno";

const adapters = new Map();
const trackedClients = new Set();
const trackedShards = new Map();

/**
 * Tracks a Discordeno client, listening to VOICE_SERVER_UPDATE and VOICE_STATE_UPDATE events
 *
 * @param bot - The Discordeno Client to track
 */
function trackClient(bot) {
	if (trackedClients.has(bot)) return;
	trackedClients.add(bot);

	let cb = bot.events.raw || function(){};
	
	bot.events.raw = function (payload) {
		if (payload.t === "VOICE_SERVER_UPDATE") {
            let adapter = adapters.get(payload.d.guild_id);

			if (adapter) {
				adapter.onVoiceServerUpdate(payload.d);
			}

        } else if (payload.t === "VOICE_STATE_UPDATE") {
            if (payload.d.guild_id && payload.d.session_id && (payload.d.user_id === bot.id.toString())) {
				let adapter = adapters.get(payload.d.guild_id);

				if (adapter) {
					adapter.onVoiceStateUpdate(payload.d);
				}
			}
		}

		cb(...arguments);
	};

	cb = bot.gateway.events.disconnected || function(){};

	bot.gateway.events.disconnected = function (shard) {
		const guilds = trackedShards.get(shard.id);

		if (guilds) {
			for (const guildId of guilds.values()) {
				adapters.get(guildId)?.destroy();
			}
		}

		trackedShards.delete(shard.id);

		cb(...arguments);
	};
}

function trackGuild(guildId, shardId) {
	let guilds = trackedShards.get(shardId);
	if (!guilds) {
		guilds = new Set();
		trackedShards.set(shardId, guilds);
	}

	guilds.add(guildId);
}

/**
 * Creates an adapter for a Voice Channel.
 *
 * @param channel - The channel to create the adapter for
 */
export function createDiscordenoAdapter(bot, guildId) {
    let shardId = bot.gateway.calculateShardId(guildId);
    let shard = bot.gateway.shards.get(shardId);

	return (methods) => {
		adapters.set(guildId, methods);
		trackClient(bot);
		trackGuild(guildId, shardId);
		return {
			sendPayload(data) {
				if (shard.state === ShardState.Connected) {
					shard.send(data);
					return true;
				}
                
				return false;
			},
			destroy() {
				return adapters.delete(guildId);
			}
		};
	};
}