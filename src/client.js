import {
    GatewayIntents,
    createBot,
    getUser,
    startBot,
    sendMessage,
    stopBot
} from "discordeno";
import { promises as fs } from "fs";

import {
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus
} from "@discordjs/voice";
import { createDiscordenoAdapter } from "./adapter.js";

/* BOT EVENTS */

const botEvents = {
    
    async ready(client, payload) {
        console.log(`Logged in at ${ new Date().toISOString() } using shard ${ payload.shardId }`);

        getUser(client, client.id).then(user => console.log(`Logged in as ${ user.username }#${ user.discriminator }`));
    },

    async voiceServerUpdate(client, payload) {
        if (client._voiceServerUpdate) {
            client._voiceServerUpdate(client, payload);
        }
    },

    async voiceStateUpdate(client, payload) {
        if (client._voiceStateUpdate) {
            client._voiceStateUpdate(client, payload);
        }
    },

    async messageCreate(client, message) {
        if (message.content === "!join") {
            sendMessage(client, message.channelId, {
                content: `Joining <#${ message.channelId }>.`,
                allowedMentions: {
                    repliedUser: false
                }
            });

            const channelId = message.channelId.toString();
            const guildId = message.guildId.toString();

            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: createDiscordenoAdapter(client, guildId)
            });

            const resource = createAudioResource("https://fi.zophar.net/soundfiles/nintendo-64-usf/banjo-kazooie/011b%20Mumbo%27s%20Mountain%20%28Normal%29.mp3", {
                inputType: StreamType.Arbitrary
            });

            const player = createAudioPlayer();
            player.play(resource);

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            } catch (error) {
                connection.destroy();
                throw error;
            }

            entersState(player, AudioPlayerStatus.Playing, 5000);
            connection.subscribe(player);
        }
    }
};

/* STARTUP / SHUTDOWN */

let onGracefulExit = () => {
    process.exit();
};

process.on("SIGINT", onGracefulExit);
process.on("SIGTERM", onGracefulExit);

console.log("Started at " + new Date().toISOString());
fs.readFile("./token.json", "utf-8").then(file => {

    const json = JSON.parse(file);

    const client = createBot({
		intents: GatewayIntents.Guilds | GatewayIntents.GuildVoiceStates | GatewayIntents.GuildMessages | GatewayIntents.MessageContent,
		token: json.token,
		events: botEvents
	});

    startBot(client);

    onGracefulExit = async () => {
        const date = new Date();
        console.log("Closed at " + date.toISOString());
    
        await stopBot(client);
        process.exit();
    }
});