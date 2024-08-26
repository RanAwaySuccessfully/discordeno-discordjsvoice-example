import {
    GatewayIntents,
    createBot
} from "discordeno";
import { appendFile, readFile } from "fs/promises";

import {
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    AudioPlayerStatus,
    EndBehaviorType,
    StreamType,
    VoiceConnectionStatus
} from "@discordjs/voice";
import OpusScript from "opusscript";

import { createDiscordenoAdapter } from "./adapter.js";

/* BOT EVENTS */

let bot;

const botEvents = {
    
    async ready(payload) {
        console.log(`Logged in at ${ new Date().toISOString() } using shard ${ payload.shardId }`);

        bot.helpers.getUser(bot.id).then(user => console.log(`Logged in as ${ user.username }#${ user.discriminator }`));
    },

    async messageCreate(message) {
        if (message.content === "!join") {
            bot.helpers.sendMessage(message.channelId, {
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
                adapterCreator: createDiscordenoAdapter(bot, guildId),
                selfDeaf: true // set to false if receiving audio
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

            // RECEIVE AUDIO EXAMPLE START

            const authorId = message.author.id;
            const receiver = connection.receiver.subscribe(String(authorId), {
                end: EndBehaviorType.Manual
            });
    
            const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
            
            receiver.on("data", chunk => {
                const decoded = encoder.decode(chunk);
                appendFile("receiver.pcm", decoded);
                // Signed 16-bit PCM, Little-endian, 2 Channels (Stereo), Sample rate 48000Hz
            });

            player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
                receiver.destroy();
                encoder.delete();
            });

            // RECEIVE AUDIO EXAMPLE END

            player.on(AudioPlayerStatus.Idle, (oldState, newState) => {
                connection.destroy();
            });
        }
    }
};

/* STARTUP / SHUTDOWN */

console.log("Started at " + new Date().toISOString());
readFile("./token.json", "utf-8").then(file => {

    const json = JSON.parse(file);

    bot = createBot({
		intents: GatewayIntents.Guilds | GatewayIntents.GuildVoiceStates | GatewayIntents.GuildMessages | GatewayIntents.MessageContent,
		token: json.token,
		events: botEvents,
        desiredProperties: {
            message: {
                author: true,
                channelId: true,
                content: true,
                guildId: true,
                id: true
            },
            user: {
                avatar: true,
                discriminator: true,
                id: true,
                username: true
            }
        }
	});

    bot.start();

    const onGracefulExit = async () => {
        let date = new Date();
        console.log("Closing at " + date.toISOString());
    
        if (bot) {
            await bot.shutdown();
        }

        date = new Date();
        console.log("Closed at " + date.toISOString());
        process.exit();
    }

    process.on("SIGINT", onGracefulExit);
    process.on("SIGTERM", onGracefulExit);
});