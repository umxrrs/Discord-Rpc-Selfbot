// Made By umxrrs/umar
// umxrrs_ on instagram
// 
const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');

let COMMAND_PREFIX = ">"; 
const USER_TOKEN = "ur token here";

let activeEmoji = null;
let dsuperreactTargets = new Map(); 

let rpcSettings = {
    enabled: false,
    largeImageKey: '',
    smallImageKey: '',
    smallImageText: '',
    largeImageText: '',
    details: '',
    state: '',
    name: 'umxrrs_', // u can change this
    buttons: [],
    url: 'https://twitch.tv/umxrrs',
    type: 'STREAMING',
    party: null,
    status: 'dnd',
    cycleDetailsInterval: null,
    cycleStateInterval: null,
    cycleNameInterval: null,
    rotateLargeInterval: null,
    rotateSmallInterval: null,
    cycleDetailsItems: [],
    cycleStateItems: [],
    cycleNameItems: [],
    rotateLargeItems: [],
    rotateSmallItems: [],
    timestamp: null,
    afk: false,
    cycleSpeed: 30000,
    rotateSpeed: 30000,
};

let autoReactUsers = {};
let autoDeleteUsers = new Set();
let deletedMessages = new Map();
let editedMessages = new Map();

const client = new Client({
    checkUpdate: false
});

// Generate headers for super reactions
function generateHeaders() {
    return {
        'Authorization': USER_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://discord.com',
        'Referer': 'https://discord.com/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'X-Debug-Options': 'bugReporterEnabled',
        'X-Discord-Locale': 'en-US',
        'X-Discord-Timezone': 'America/New_York',
        'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMC4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTIwLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjI2MDMxNiwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0='
    };
}

// Utility functions
function isCustomEmoji(emoji) {
    return emoji.match(/<a?:([a-zA-Z0-9_]+):(\d+)>/);
}

function encodeSuperEmoji(emoji) {
    const customMatch = isCustomEmoji(emoji);
    if (customMatch) {
        const animated = emoji.startsWith('<a') ? 'a' : '';
        return `${animated}:${customMatch[1]}:${customMatch[2]}`;
    }
    return Array.from(emoji)
        .map(char => {
            return Array.from(new TextEncoder().encode(char))
                .map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
                .join('');
        })
        .join('');
}

function validateEmoji(emoji) {
    return isCustomEmoji(emoji) || /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(emoji);
}

async function superReactToMessage(message, emoji) {
    try {
        if (!validateEmoji(emoji)) {
            console.error(`Invalid emoji: ${emoji}`);
            return;
        }
        const encodedEmoji = encodeSuperEmoji(emoji);
        const url = `https://discord.com/api/v9/channels/${message.channel.id}/messages/${message.id}/reactions/${encodedEmoji}/@me?location=Message%20Reaction%20Picker&type=1`;
        
        const headers = generateHeaders();
        
        const response = await axios.put(url, {}, {
            headers: headers,
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status < 500
        });
        
        if (!(response.status === 200 || response.status === 204)) {
            console.error(`⚠️ Reaction response: ${response.status} - ${emoji}`);
        }
    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 1;
            setTimeout(() => superReactToMessage(message, emoji), retryAfter * 1000);
        } else if (error.response?.status === 401) {
            console.error('❌ Unauthorized - Check your token');
        } else {
            console.error(`❌ Super reaction failed for ${emoji}:`, error.response?.data?.message || error.message);
        }
    }
}

function parseCommand(content) {
    if (!content.startsWith(COMMAND_PREFIX)) return null;
    
    const args = content.slice(COMMAND_PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    
    return command ? { command, args } : null;
}

// Safe interval wrapper
const safeInterval = (fn, time) => {
    const interval = setInterval(() => {
        try {
            fn();
        } catch (e) {
            console.error(`Interval error at ${new Date().toISOString()}:`, e);
        }
    }, time);
    return interval;
};

// Validate URL
const isValidUrl = (url) => {
    const cleanedUrl = url.trim().replace(/^["']|["']$/g, '');
    try {
        new URL(cleanedUrl);
        return cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://');
    } catch {
        return false;
    }
};

// Update RPC
const updateRPC = () => {
    try {
        client.user.setStatus(rpcSettings.status);
        if (rpcSettings.enabled) {
            const presenceData = {
                activities: [{
                    name: rpcSettings.name || 'Custom RPC',
                    type: rpcSettings.type === 'STREAMING' ? 1 :
                          rpcSettings.type === 'LISTENING' ? 2 :
                          rpcSettings.type === 'WATCHING' ? 3 :
                          rpcSettings.type === 'COMPETING' ? 5 : 0,
                    url: rpcSettings.type === 'STREAMING' && isValidUrl(rpcSettings.url) ? rpcSettings.url : undefined,
                    details: rpcSettings.details || undefined,
                    state: rpcSettings.state || undefined,
                    assets: {},
                    buttons: rpcSettings.buttons.length > 0 ? rpcSettings.buttons.map(btn => btn.label) : undefined,
                    party: rpcSettings.party ? { size: [rpcSettings.party.current, rpcSettings.party.max] } : undefined,
                    timestamps: rpcSettings.timestamp ? { start: rpcSettings.timestamp } : undefined,
                }],
                status: rpcSettings.status,
                afk: rpcSettings.afk,
                client_status: {
                    web: rpcSettings.status === 'invisible' ? 'offline' : rpcSettings.status
                }
            };

            if (rpcSettings.largeImageKey && isValidUrl(rpcSettings.largeImageKey)) {
                presenceData.activities[0].assets.large_image = rpcSettings.largeImageKey;
            }
            if (rpcSettings.largeImageText) {
                presenceData.activities[0].assets.large_text = rpcSettings.largeImageText;
            }
            if (rpcSettings.smallImageKey && isValidUrl(rpcSettings.smallImageKey)) {
                presenceData.activities[0].assets.small_image = rpcSettings.smallImageKey;
            }
            if (rpcSettings.smallImageText) {
                presenceData.activities[0].assets.small_text = rpcSettings.smallImageText;
            }
            client.user.setPresence(presenceData);
        } else {
            const presenceData = {
                activities: [],
                status: rpcSettings.status,
                afk: rpcSettings.afk,
                client_status: {
                    web: rpcSettings.status === 'invisible' ? 'offline' : rpcSettings.status
                }
            };
            client.user.setPresence(presenceData);
        }
    } catch (error) {
        console.error(`Failed to set presence at ${new Date().toISOString()}:`, error);
    }
};

const startCycle = (type, items) => {
    let interval;
    if (type === 'details') {
        interval = rpcSettings.cycleDetailsInterval;
        if (interval) clearInterval(interval);
        rpcSettings.cycleDetailsItems = items;
    } else if (type === 'state') {
        interval = rpcSettings.cycleStateInterval;
        if (interval) clearInterval(interval);
        rpcSettings.cycleStateItems = items;
    } else if (type == 'name') {
        interval = rpcSettings.cycleNameInterval;
        if (interval) clearInterval(interval);
        rpcSettings.cycleNameItems = items;
    }

    let index = 0;
    interval = safeInterval(() => {
        if (type === 'details') rpcSettings.details = items[index];
        else if (type === 'state') rpcSettings.state = items[index];
        else if (type === 'name') rpcSettings.name = items[index];
        index = (index + 1) % items.length;
        updateRPC();
    }, rpcSettings.cycleSpeed);

    if (type === 'details') rpcSettings.cycleDetailsInterval = interval;
    else if (type === 'state') rpcSettings.cycleStateInterval = interval;
    else if (type === 'name') rpcSettings.cycleNameInterval = interval;
};

const startRotate = async (type, urls, message) => {
    let interval = type === 'large' ? rpcSettings.rotateLargeInterval : rpcSettings.rotateSmallInterval;
    if (interval) clearInterval(interval);

    const validUrls = urls.map(url => url.trim().replace(/^["']|["']$/g, '')).filter(isValidUrl);
    if (validUrls.length < 2) {
        await message.edit(`Need at least 2 valid URLs for rotation. Found ${validUrls.length}: ${validUrls.join(', ')}`);
        return;
    }

    const itemsArray = type === 'large' ? rpcSettings.rotateLargeItems : rpcSettings.rotateSmallItems;
    itemsArray.length = 0;
    itemsArray.push(...validUrls);

    let index = 0;
    interval = safeInterval(() => {
        if (type === 'large') rpcSettings.largeImageKey = validUrls[index];
        else rpcSettings.smallImageKey = validUrls[index];
        index = (index + 1) % validUrls.length;
        updateRPC();
    }, rpcSettings.rotateSpeed);

    if (type === 'large') rpcSettings.rotateLargeInterval = interval;
    else rpcSettings.rotateSmallInterval = interval;

    await message.edit(`Started rotating ${type} images between: ${validUrls.join(', ')}`);
};

const getMenu = () => {
    return `\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mCATEGORIES[0m

[2;34m[✟][0m [2;31mPRESENCE[0m | [[2;35m22[0m [2;36mcmds[0m]
[2;34m[✟][0m [2;31mUTILITY [0m | [[2;35m12[0m [2;36mcmds[0m]
\`\`\``;
};

const getPresenceMenuPart1 = () => {
    return `\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mPRESENCE[0m

[2;37m[✟][0m [2;31mPRESENCE COMMANDS[0m

    [2;31m[GENERAL][0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc on           [0m | [2;35mTurns on the RPC[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc off          [0m | [2;35mTurns off the RPC[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc reset        [0m | [2;35mResets all settings[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc info         [0m | [2;35mShows current settings[0m
    [2;31m[SETTINGS][0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc name <text>  [0m | [2;35mSets RPC name[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc detail <text>[0m | [2;35mSets RPC details[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc state <text> [0m | [2;35mSets RPC state[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc rmstate      [0m | [2;35mRemoves state[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc li <url>     [0m | [2;35mSets large image[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc sl <url>     [0m | [2;35mSets small image[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc lt <text>    [0m | [2;35mSets large image text[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc st <text>    [0m | [2;35mSets small image text[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc rmsmall      [0m | [2;35mRemoves small image & text[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc rmlt         [0m | [2;35mRemoves large image text[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc url <url>    [0m | [2;35mSets streaming URL[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc type <type>  [0m | [2;35mSets RPC type (Playing, Watching, Listening, Streaming, Competing)[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc status <type>[0m | [2;35mSets status (online, idle, dnd, invisible)[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc afk <on|off> [0m | [2;35mSets AFK status[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc timestamp <now|clear>[0m | [2;35mSets/clears timestamp[0m
\`\`\``;
};

const getPresenceMenuPart2 = () => {
    return `\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mPRESENCE (CONTINUED)[0m

[2;37m[✟][0m [2;31mPRESENCE COMMANDS[0m

    [2;31m[CYCLE][0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc cycle <details|state|name> <t1>|<t2>[0m | [2;35mCycles text[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc removecycle <details|state|name>[0m | [2;35mRemoves cycle[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc rotate <large|small> <u1>|<u2>[0m | [2;35mRotates images[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc removerotate <large|small>[0m | [2;35mRemoves rotation[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc cyclespeed <ms>[0m | [2;35mSets cycle speed[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc rotatempo <ms>[0m | [2;35mSets rotate speed[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc stopcycle    [0m | [2;35mStops all cycling[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc stoprotate   [0m | [2;35mStops all rotation[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc btn <name> <url>[0m | [2;35mAdds a button[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc clrbtns      [0m | [2;35mClears all buttons[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc party size <cur> <max>[0m | [2;35mSets party size[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}rpc party clear [0m | [2;35mClears party size[0m
\`\`\``;
};

const getUtilityMenu = () => {
    return `\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mUTILITY[0m

[2;37m[✟][0m [2;31mUTILITY COMMANDS[0m

    [2;31m[MESSAGES][0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}autoreact <@user> <emoji>[0m | [2;35mAuto reacts to user's messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}stopautoreact <@user>[0m | [2;35mStops auto reactions for user[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}superreact <emoji>[0m | [2;35mAuto super reacts to your messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}dsuperreact <@user> <emoji1> [emoji2]...[0m | [2;35mAuto super reacts to user's messages with rotating emojis[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}dsuperreactstop <@user>[0m | [2;35mStops super reactions for user[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}stopsuperreact[0m | [2;35mStops all super reactions[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}autodelete <@user>[0m | [2;35mAuto deletes user's messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}stopautodelete <@user>[0m | [2;35mStops auto deleting user's messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}snipe[0m | [2;35mSnipes recent deleted messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}editsnipe[0m | [2;35mSnipes recent edited messages[0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}purge <amount>[0m | [2;35mPurges your messages[0m
    [2;31m[CONFIG][0m
    [2;37m[+][0m [2;32m${COMMAND_PREFIX}setprefix <prefix>[0m | [2;35mChanges command prefix[0m
\`\`\``;
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    updateRPC();
    safeInterval(() => {
        updateRPC();
    }, 45 * 60 * 1000);
});

client.on('debug', (info) => console.error(`Debug at ${new Date().toISOString()}:`, info));

client.on('disconnect', () => {
    console.log('Disconnected, attempting to reconnect...');
    client.login(USER_TOKEN);
});

client.on('messageDelete', (message) => {
    if (message.author && message.channel) {
        deletedMessages.set(message.channel.id, {
            author: message.author.tag,
            authorId: message.author.id,
            content: message.content || '',
            attachments: message.attachments.map(a => a.url).join(', ') || 'None',
            timestamp: new Date().toISOString(),
        });
    }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (oldMessage.author && oldMessage.content !== newMessage.content && oldMessage.channel) {
        editedMessages.set(oldMessage.channel.id, {
            author: oldMessage.author.tag,
            authorId: oldMessage.author.id,
            oldContent: oldMessage.content || '',
            newContent: newMessage.content || '',
            timestamp: new Date().toISOString(),
        });
    }
});

client.on('messageCreate', async (message) => {
    if (dsuperreactTargets.has(message.author.id)) {
        const target = dsuperreactTargets.get(message.author.id);
        const emoji = target.emojis[target.currentIndex];
        const delay = Math.random() * 500 + 200;
        setTimeout(async () => {
            await superReactToMessage(message, emoji);
        }, delay);
        target.currentIndex = (target.currentIndex + 1) % target.emojis.length;
        dsuperreactTargets.set(message.author.id, target);
    }

    if (autoReactUsers[message.author.id]) {
        try {
            await message.react(autoReactUsers[message.author.id]);
        } catch (error) {
            console.error(`Autoreact error for ${message.author.tag}:`, error.message);
        }
    }

    if (autoDeleteUsers.has(message.author.id)) {
        try {
            await message.delete();
        } catch (error) {
            console.error(`Autodelete error for ${message.author.tag}:`, error.message);
        }
    }

    if (message.author.id === client.user.id && activeEmoji && !message.content.startsWith(COMMAND_PREFIX)) {
        await superReactToMessage(message, activeEmoji);
    }

    if (message.author.id !== client.user.id || !message.content.startsWith(COMMAND_PREFIX)) return;

    const parsed = parseCommand(message.content);
    if (!parsed) return;

    const { command, args } = parsed;

    try {
        switch (command) {
            case 'menu':
                await message.edit(getMenu());
                break;

            case 'presence':
                await message.edit(getPresenceMenuPart1());
                await message.channel.send(getPresenceMenuPart2());
                break;

            case 'utility':
                await message.edit(getUtilityMenu());
                break;

            case 'rpc':
                if (!args[0]) {
                    await message.edit('Please specify a subcommand (e.g., >rpc on)');
                    return;
                }
                switch (args[0].toLowerCase()) {
                    case 'on':
                        rpcSettings.enabled = true;
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC ENABLED![0m\n```');
                        updateRPC();
                        break;

                    case 'off':
                        rpcSettings.enabled = false;
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mRPC DISABLED![0m\n```');
                        updateRPC();
                        break;

                    case 'reset':
                        if (rpcSettings.cycleDetailsInterval) clearInterval(rpcSettings.cycleDetailsInterval);
                        if (rpcSettings.cycleStateInterval) clearInterval(rpcSettings.cycleStateInterval);
                        if (rpcSettings.rotateLargeInterval) clearInterval(rpcSettings.rotateLargeInterval);
                        if (rpcSettings.rotateSmallInterval) clearInterval(rpcSettings.rotateSmallInterval);
                        rpcSettings = {
                            enabled: false,
                            largeImageKey: '',
                            smallImageKey: '',
                            smallImageText: '',
                            largeImageText: '',
                            details: '',
                            state: '',
                            name: '',
                            buttons: [],
                            url: '',
                            type: 'PLAYING',
                            party: null,
                            status: 'online',
                            cycleDetailsInterval: null,
                            cycleStateInterval: null,
                            rotateLargeInterval: null,
                            rotateSmallInterval: null,
                            cycleDetailsItems: [],
                            cycleStateItems: [],
                            rotateLargeItems: [],
                            rotateSmallItems: [],
                            timestamp: null,
                            afk: false,
                            cycleSpeed: 30000,
                            rotateSpeed: 30000,
                        };
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mRPC RESET![0m\n```');
                        updateRPC();
                        break;

                    case 'info':
                        const info = `\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mRPC INFO[0m

RPC Enabled: ${rpcSettings.enabled}
Name: ${rpcSettings.name || 'None'}
Type: ${rpcSettings.type}
Details: ${rpcSettings.details || 'None'}
State: ${rpcSettings.state || 'None'}
Large Image: ${rpcSettings.largeImageKey || 'None'}
Large Text: ${rpcSettings.largeImageText || 'None'}
Small Image: ${rpcSettings.smallImageKey || 'None'}
Small Text: ${rpcSettings.smallImageText || 'None'}
Buttons: ${rpcSettings.buttons.length > 0 ? rpcSettings.buttons.map(b => `${b.label} (${b.url})`).join(', ') : 'None'}
Party: ${rpcSettings.party ? `${rpcSettings.party.current}/${rpcSettings.party.max}` : 'None'}
URL: ${rpcSettings.url || 'None'}
Status: ${rpcSettings.status}
AFK: ${rpcSettings.afk}
Cycling Name: ${rpcSettings.cycleNameItems.length > 0 ? rpcSettings.cycleNameItems.join(', ') : 'No'}
Cycling Details: ${rpcSettings.cycleDetailsItems.length > 0 ? rpcSettings.cycleDetailsItems.join(', ') : 'No'}
Cycling State: ${rpcSettings.cycleStateItems.length > 0 ? rpcSettings.cycleStateItems.join(', ') : 'No'}
Rotating Large: ${rpcSettings.rotateLargeItems.length > 0 ? rpcSettings.rotateLargeItems.join(', ') : 'No'}
Rotating Small: ${rpcSettings.rotateSmallItems.length > 0 ? rpcSettings.rotateSmallItems.join(', ') : 'No'}
\`\`\``;
                        await message.edit(info);
                        break;

                    case 'name':
                        if (!args[1]) {
                            await message.edit('Please provide a name (e.g., >rpc name a)');
                            return;
                        }
                        rpcSettings.name = args.slice(1).join(' ').slice(0, 128);
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC NAME SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.name}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'detail':
                        if (!args[1]) {
                            await message.edit('Please provide details (e.g., >rpc detail a)');
                            return;
                        }
                        rpcSettings.details = args.slice(1).join(' ').slice(0, 128);
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC DETAILS SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.details}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'state':
                        if (!args[1]) {
                            await message.edit('Please provide a state (e.g., >rpc state a)');
                            return;
                        }
                        rpcSettings.state = args.slice(1).join(' ').slice(0, 128);
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC STATE SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.state}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'rmstate':
                        rpcSettings.state = '';
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mRPC STATE REMOVED![0m\n```');
                        updateRPC();
                        break;

                    case 'li':
                        if (!args[1]) {
                            await message.edit('Please provide a URL (e.g., >rpc li https://example.com/image.png)');
                            return;
                        }
                        const largeUrl = args.slice(1).join(' ').trim().replace(/^["']|["']$/g, '');
                        if (isValidUrl(largeUrl)) {
                            rpcSettings.largeImageKey = largeUrl;
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mLARGE IMAGE SET![0m

[2;35mSet to: [0m[2;31m${largeUrl}[0m
\`\`\``);
                            updateRPC();
                        } else {
                            await message.edit('Invalid URL (must start with http:// or https://)');
                        }
                        break;

                    case 'sl':
                        if (!args[1]) {
                            await message.edit('Please provide a URL (e.g., >rpc sl https://example.com/image.png)');
                            return;
                        }
                        const smallUrl = args.slice(1).join(' ').trim().replace(/^["']|["']$/g, '');
                        if (isValidUrl(smallUrl)) {
                            rpcSettings.smallImageKey = smallUrl;
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mSMALL IMAGE SET![0m

[2;35mSet to: [0m[2;31m${smallUrl}[0m
\`\`\``);
                            updateRPC();
                        } else {
                            await message.edit('Invalid URL (must start with http:// or https://)');
                        }
                        break;

                    case 'lt':
                        if (!args[1]) {
                            await message.edit('Please provide text (e.g., >rpc lt Hover text)');
                            return;
                        }
                        rpcSettings.largeImageText = args.slice(1).join(' ').slice(0, 128);
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mLARGE IMAGE TEXT SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.largeImageText}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'st':
                        if (!args[1]) {
                            await message.edit('Please provide text (e.g., >rpc st Small hover text)');
                            return;
                        }
                        rpcSettings.smallImageText = args.slice(1).join(' ').slice(0, 128);
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mSMALL IMAGE TEXT SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.smallImageText}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'rmsmall':
                        rpcSettings.smallImageKey = '';
                        rpcSettings.smallImageText = '';
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSMALL IMAGE & TEXT REMOVED![0m\n```');
                        updateRPC();
                        break;

                    case 'rmlt':
                        rpcSettings.largeImageText = '';
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mLARGE IMAGE TEXT REMOVED![0m\n```');
                        updateRPC();
                        break;

                    case 'url':
                        if (!args[1]) {
                            await message.edit('Please provide a URL (e.g., >rpc url https://twitch.tv/umxrrs)');
                            return;
                        }
                        const streamUrl = args.slice(1).join(' ').trim().replace(/^["']|["']$/g, '');
                        if (isValidUrl(streamUrl)) {
                            rpcSettings.url = streamUrl;
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mSTREAM URL SET![0m

[2;35mSet to: [0m[2;31m${streamUrl}[0m
\`\`\``);
                            updateRPC();
                        } else {
                            await message.edit('Invalid stream URL (must start with http:// or https://)');
                        }
                        break;

                    case 'type':
                        if (!args[1]) {
                            await message.edit('Please provide a type (e.g., >rpc type Playing)');
                            return;
                        }
                        const type = args[1].toUpperCase();
                        if (['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING', 'COMPETING'].includes(type)) {
                            rpcSettings.type = type;
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC TYPE SET![0m

[2;35mSet to: [0m[2;31m${type}[0m
\`\`\``);
                            updateRPC();
                        } else {
                            await message.edit('Invalid type! Use: Playing, Watching, Listening, Streaming, Competing');
                        }
                        break;

                    case 'status':
                        if (!args[1]) {
                            await message.edit('Please provide a status (e.g., >rpc status online)');
                            return;
                        }
                        const status = args[1].toLowerCase();
                        if (['online', 'idle', 'dnd', 'invisible'].includes(status)) {
                            rpcSettings.status = status;
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mRPC STATUS SET![0m

[2;35mSet to: [0m[2;31m${status}[0m
\`\`\``);
                            updateRPC();
                        } else {
                            await message.edit('Invalid status! Use: online, idle, dnd, invisible');
                        }
                        break;

                    case 'afk':
                        if (!args[1]) {
                            await message.edit('Please provide on or off (e.g., >rpc afk on)');
                            return;
                        }
                        rpcSettings.afk = args[1].toLowerCase() === 'on';
                        await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mAFK SET![0m

[2;35mSet to: [0m[2;31m${rpcSettings.afk ? 'on' : 'off'}[0m
\`\`\``);
                        updateRPC();
                        break;

                    case 'timestamp':
                        if (!args[1]) {
                            await message.edit('Please provide now or clear (e.g., >rpc timestamp now)');
                            return;
                        }
                        if (args[1] === 'clear') {
                            rpcSettings.timestamp = null;
                            await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mTIMESTAMP CLEARED![0m\n```');
                        } else if (args[1] === 'now') {
                            rpcSettings.timestamp = Date.now();
                            await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mTIMESTAMP SET![0m\n\n[2;35mSet to current time[0m\n```');
                        } else {
                            await message.edit('Invalid option! Use: now, clear');
                        }
                        updateRPC();
                        break;

                    case 'cycle':
                        if (!args[1] || !args[2]) {
                            await message.edit('Use: >rpc cycle <details|state|name> <text1>,<text2>');
                            return;
                        }
                        const cycleType = args[1].toLowerCase();
                        if (['details', 'state', 'name'].includes(cycleType)) {
                            const items = args.slice(2).join(' ').split(',').map(item => item.trim().slice(0, 128));
                            if (items.length >= 2) {
                                startCycle(cycleType, items);
                                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mCYCLE STARTED![0m

[2;35mCycling ${cycleType} between: [0m${items.join(', ')}
\`\`\``);
                            } else {
                                await message.edit('Please provide at least 2 items separated by commas');
                            }
                        } else {
                            await message.edit('Invalid cycle type! Use: details, state, name');
                        }
                        break;

                    case 'removecycle':
                        if (!args[1]) {
                            await message.edit('Use: >rpc removecycle <details|state|name>');
                            return;
                        }
                        const removeCycleType = args[1].toLowerCase();
                        if (removeCycleType === 'details') {
                            if (rpcSettings.cycleDetailsInterval) {
                                clearInterval(rpcSettings.cycleDetailsInterval);
                                rpcSettings.cycleDetailsInterval = null;
                                rpcSettings.cycleDetailsItems = [];
                                await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mDETAILS CYCLE REMOVED![0m\n```');
                            } else {
                                await message.edit('No details cycle active');
                            }
                        } else if (removeCycleType === 'state') {
                            if (rpcSettings.cycleStateInterval) {
                                clearInterval(rpcSettings.cycleStateInterval);
                                rpcSettings.cycleStateInterval = null;
                                rpcSettings.cycleStateItems = [];
                                await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSTATE CYCLE REMOVED![0m\n```');
                            } else {
                                await message.edit('No state cycle active');
                            }
                        } else if (removeCycleType === 'name') {
                            if (rpcSettings.cycleNameInterval) {
                                clearInterval(rpcSettings.cycleNameInterval);
                                rpcSettings.cycleNameInterval = null;
                                rpcSettings.cycleNameItems = [];
                                await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mNAME CYCLE REMOVED![0m\n```');
                            } else {
                                await message.edit('No name cycle active');
                            }
                        } else {
                            await message.edit('Invalid cycle type! Use: details, state, name');
                        }
                        updateRPC();
                        break;

                    case 'rotate':
                        if (!args[1] || !args[2]) {
                            await message.edit('Use: >rpc rotate <large|small> <url1>|<url2>');
                            return;
                        }
                        const rotateType = args[1].toLowerCase();
                        if (rotateType === 'large' || rotateType === 'small') {
                            const urls = args.slice(2).join(' ').split('|');
                            await startRotate(rotateType, urls, message);
                        } else {
                            await message.edit('Invalid rotate type! Use: large, small');
                        }
                        break;

                    case 'removerotate':
                        if (!args[1]) {
                            await message.edit('Use: >rpc removerotate <large|small>');
                            return;
                        }
                        const removeRotateType = args[1].toLowerCase();
                        if (removeRotateType === 'large') {
                            if (rpcSettings.rotateLargeInterval) {
                                clearInterval(rpcSettings.rotateLargeInterval);
                                rpcSettings.rotateLargeInterval = null;
                                rpcSettings.rotateLargeItems = [];
                                await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mLARGE IMAGE ROTATION REMOVED![0m\n```');
                            } else {
                                await message.edit('No large image rotation active');
                            }
                        } else if (removeRotateType === 'small') {
                            if (rpcSettings.rotateSmallInterval) {
                                clearInterval(rpcSettings.rotateSmallInterval);
                                rpcSettings.rotateSmallInterval = null;
                                rpcSettings.rotateSmallItems = [];
                                await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSMALL IMAGE ROTATION REMOVED![0m\n```');
                            } else {
                                await message.edit('No small image rotation active');
                            }
                        } else {
                            await message.edit('Invalid rotation type! Use: large, small');
                        }
                        updateRPC();
                        break;

                    case 'cyclespeed':
                        if (!args[1]) {
                            await message.edit('Please provide a speed in milliseconds (e.g., >rpc cyclespeed 5000)');
                            return;
                        }
                        const speed = parseInt(args[1]);
                        if (isNaN(speed) || speed < 1000) {
                            await message.edit('Please provide a speed in milliseconds (minimum 1000)');
                        } else {
                            rpcSettings.cycleSpeed = speed;
                            if (rpcSettings.cycleDetailsInterval) startCycle('details', rpcSettings.cycleDetailsItems);
                            if (rpcSettings.cycleStateInterval) startCycle('state', rpcSettings.cycleStateItems);
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mCYCLE SPEED SET![0m

[2;35mSet to: [0m[2;31m${speed}ms[0m
\`\`\``);
                        }
                        break;

                    case 'rotatempo':
                        if (!args[1]) {
                            await message.edit('Please provide a speed in milliseconds (e.g., >rpc rotatempo 5000)');
                            return;
                        }
                        const rotateSpeed = parseInt(args[1]);
                        if (isNaN(rotateSpeed) || rotateSpeed < 1000) {
                            await message.edit('Please provide a speed in milliseconds (minimum 1000)');
                        } else {
                            rpcSettings.rotateSpeed = rotateSpeed;
                            if (rpcSettings.rotateLargeInterval) startRotate('large', rpcSettings.rotateLargeItems, message);
                            if (rpcSettings.rotateSmallInterval) startRotate('small', rpcSettings.rotateSmallItems, message);
                            await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mROTATE SPEED SET![0m

[2;35mSet to: [0m[2;31m${rotateSpeed}ms[0m
\`\`\``);
                        }
                        break;

                    case 'stopcycle':
                        if (rpcSettings.cycleDetailsInterval || rpcSettings.cycleStateInterval || rpcSettings.cycleNameInterval) {
                            clearInterval(rpcSettings.cycleDetailsInterval);
                            clearInterval(rpcSettings.cycleStateInterval);
                            clearInterval(rpcSettings.cycleNameInterval);
                            rpcSettings.cycleDetailsInterval = null;
                            rpcSettings.cycleStateInterval = null;
                            rpcSettings.cycleNameInterval = null;
                            rpcSettings.cycleDetailsItems = [];
                            rpcSettings.cycleStateItems = [];
                            rpcSettings.cycleNameItems = [];
                            await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mALL CYCLES STOPPED![0m\n```');
                            updateRPC();
                        } else {
                            await message.edit('No active cycles to stop');
                        }
                        break;

                    case 'stoprotate':
                        if (rpcSettings.rotateLargeInterval || rpcSettings.rotateSmallInterval) {
                            clearInterval(rpcSettings.rotateLargeInterval);
                            clearInterval(rpcSettings.rotateSmallInterval);
                            rpcSettings.rotateLargeInterval = null;
                            rpcSettings.rotateSmallInterval = null;
                            rpcSettings.rotateLargeItems = [];
                            rpcSettings.rotateSmallItems = [];
                            await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mALL ROTATIONS STOPPED![0m\n```');
                            updateRPC();
                        } else {
                            await message.edit('No active rotations to stop');
                        }
                        break;

                    case 'btn':
                        if (args.length < 2) {
                            await message.edit('Please provide a name and URL (e.g., >rpc btn "Watch Episode" https://www.netflix.com/pk)');
                            return;
                        }
                        if (rpcSettings.buttons.length < 2) {
                            const btnUrl = args[args.length - 1].trim().replace(/^["']|["']$/g, '');
                            const btnName = args.slice(1, -1).join(' ').trim().slice(0, 32) || 'Button';
                            if (isValidUrl(btnUrl)) {
                                rpcSettings.buttons.push({ label: btnName, url: btnUrl });
                                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mBUTTON ADDED![0m

[2;35mAdded: [0m[2;31m${btnName} - ${btnUrl}[0m
\`\`\``);
                                updateRPC();
                            } else {
                                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m

[2;35mInvalid URL: ${btnUrl} (must start with http:// or https:// and be a valid URL)
\`\`\``);
                            }
                        } else {
                            await message.edit('Maximum 2 buttons allowed');
                        }
                        break;

                    case 'clrbtns':
                        rpcSettings.buttons = [];
                        await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mBUTTONS CLEARED![0m\n```');
                        updateRPC();
                        break;

                    case 'party':
                        if (!args[1]) {
                            await message.edit('Use: >rpc party <size <cur> <max>|clear>');
                            return;
                        }
                        if (args[1] === 'clear') {
                            rpcSettings.party = null;
                            await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mPARTY SIZE CLEARED![0m\n```');
                        } else if (args[1] === 'size') {
                            const current = parseInt(args[2]);
                            const max = parseInt(args[3]);
                            if (isNaN(current) || isNaN(max) || current < 0 || max < current) {
                                await message.edit('Please provide valid numbers for current and max (current <= max)');
                            } else {
                                rpcSettings.party = { current, max };
                                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mPARTY SIZE SET![0m

[2;35mSet to: [0m[2;31m${current}/${max}[0m
\`\`\``);
                            }
                        } else {
                            await message.edit('Invalid party command! Use: size <cur> <max>, clear');
                        }
                        updateRPC();
                        break;

                    default:
                        await message.edit(`Unknown subcommand: ${args[0]}. Use ${COMMAND_PREFIX}presence to see available commands.`);
                        break;
                }
                break;

            case 'superreact':
                if (args.length === 0) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mUsage: >superreact <emoji>\n```');
                    return;
                }
                activeEmoji = args.join(' ');
                if (!validateEmoji(activeEmoji)) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mInvalid emoji. Use a valid emoji or custom emoji.\n```');
                    activeEmoji = null;
                    return;
                }
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mSUPERREACT ON![0m

[2;35mYour messages will be super reacted with [0m[2;31m${activeEmoji}[0m
[2;32m[SET ACTIVE EMOJI FOR SUPERREACT][0m : ${activeEmoji}
\`\`\``);
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'dsuperreact':
                if (args.length < 2) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mUsage: >dsuperreact <@user> <emoji1> [emoji2] ...\n```');
                    return;
                }
                const userMention = args[0];
                const userId = userMention.replace(/[<@!>]/g, '');
                const user = message.mentions.users.first() || client.users.cache.get(userId);
                if (!user) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mPlease provide a valid user with @mention or ID\n```');
                    return;
                }
                const emojis = args.slice(1);
                if (emojis.length === 0) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mNo emojis provided\n```');
                    return;
                }
                if (!emojis.every(validateEmoji)) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mOne or more invalid emojis provided\n```');
                    return;
                }
                dsuperreactTargets.set(userId, {
                    emojis: emojis,
                    currentIndex: 0
                });
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mSUPERREACT ON![0m

[2;35mMessages of ${user.tag} will be super reacted with [0m[2;31m${emojis.join(', ')}[0m
\`\`\``);
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'dsuperreactstop':
                if (args.length === 0) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mUsage: >dsuperreactstop <@user>\n```');
                    return;
                }
                const dsuperStopUserMention = args[0];
                const dsuperStopUserId = dsuperStopUserMention.replace(/[<@!>]/g, '');
                const dsuperTargetUser = message.mentions.users.first() || client.users.cache.get(dsuperStopUserId);
                if (!dsuperTargetUser) {
                    await message.edit('```ansi\n[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mERROR[0m\n\n[2;35mInvalid user, please provide a valid @mention or ID\n```');
                    return;
                }
                if (dsuperreactTargets.has(dsuperStopUserId)) {
                    dsuperreactTargets.delete(dsuperStopUserId);
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSUPERREACT OFF![0m

[2;36mSuperreact stopped for [0m[2;31m${dsuperTargetUser.tag}[0m
\`\`\``);
                } else {
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mINFO[0m

[2;35mNo active super reactions for ${dsuperTargetUser.tag}
\`\`\``);
                }
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'stopsuperreact':
                activeEmoji = null;
                dsuperreactTargets.clear();
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSUPERREACT OFF![0m

[2;36mAll super reactions stopped[0m
\`\`\``);
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'autoreact':
                if (!args[0] || !args[1]) {
                    await message.edit('Please provide a user and an emoji (e.g., >autoreact @user 💀)');
                    return;
                }
                const autoReactTargetUser = message.mentions.users.first() || client.users.cache.get(args[0].replace(/[<@!]/g, ''));
                const autoReactEmoji = args[1];
                if (!autoReactTargetUser) {
                    await message.edit('Please mention a valid user or provide a user ID');
                    return;
                }
                if (!validateEmoji(autoReactEmoji)) {
                    await message.edit('Invalid emoji. Please use a valid emoji or custom emoji');
                    return;
                }
                try {
                    await message.react(autoReactEmoji);
                    autoReactUsers[autoReactTargetUser.id] = autoReactEmoji;
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mAUTOREACT ON![0m

[2;35mMessages of ${autoReactTargetUser.tag} will be reacted with [0m[2;31m${autoReactEmoji}[0m
\`\`\``);
                } catch (error) {
                    await message.edit('Failed to set autoreact. Please check the emoji or permissions');
                    console.error(`Autoreact error for ${autoReactTargetUser.tag}:`, error.message);
                    return;
                }
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'stopautoreact':
                if (!args[0]) {
                    await message.edit('Please provide a user (e.g., >stopautoreact @user)');
                    return;
                }
                const stopUser = message.mentions.users.first() || client.users.cache.get(args[0].replace(/[<@!]/g, ''));
                if (!stopUser) {
                    await message.edit('Please mention a valid user or provide a user ID');
                    return;
                }
                if (autoReactUsers[stopUser.id]) {
                    delete autoReactUsers[stopUser.id];
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mAUTOREACT OFF![0m

[2;36mAutoreact stopped for [0m[2;31m${stopUser.tag}[0m
\`\`\``);
                } else {
                    await message.edit(`No active autoreact for ${stopUser.tag}`);
                }
                setTimeout(() => message.delete().catch(() => {}), Math.floor(Math.random() * 60000) + 60000);
                break;

            case 'autodelete':
                if (!args[0]) {
                    await message.edit('Please provide a user (e.g., >autodelete @user)');
                    return;
                }
                const deleteUser = message.mentions.users.first() || client.users.cache.get(args[0].replace(/[<@!]/g, ''));
                if (!deleteUser) {
                    await message.edit('Please mention a valid user or provide a user ID');
                    return;
                }
                autoDeleteUsers.add(deleteUser.id);
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mAUTODELETE ON![0m

[2;35mMessages of ${deleteUser.tag} will be autodeleted
\`\`\``);
                setTimeout(() => message.delete().catch(() => {}), 100);
                break;

            case 'stopautodelete':
                if (!args[0]) {
                    await message.edit('Please provide a user (e.g., >stopautodelete @user)');
                    return;
                }
                const stopDeleteUser = message.mentions.users.first() || client.users.cache.get(args[0].replace(/[<@!]/g, ''));
                if (!stopDeleteUser) {
                    await message.edit('Please mention a valid user or provide a user ID');
                    return;
                }
                if (autoDeleteUsers.has(stopDeleteUser.id)) {
                    autoDeleteUsers.delete(stopDeleteUser.id);
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mAUTODELETE OFF![0m

[2;36mAutodelete stopped for [0m[2;31m${stopDeleteUser.tag}[0m
\`\`\``);
                } else {
                    await message.edit(`No active autodelete for ${stopDeleteUser.tag}`);
                }
                setTimeout(() => message.delete().catch(() => {}), 100);
                break;

            case 'snipe':
                const deleted = deletedMessages.get(message.channel.id);
                if (!deleted) {
                    await message.edit('No deleted messages to snipe in this channel');
                    return;
                }
                const snipeContent = deleted.content || deleted.attachments;
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;30mSNIPED DELETED MESSAGE[0m

[2;34m Sent By[${deleted.author}][0m [${deleted.authorId}]
\`\`\`
${snipeContent}`);
                break;

            case 'editsnipe':
                const edited = editedMessages.get(message.channel.id);
                if (!edited) {
                    await message.edit('No edited messages to snipe in this channel');
                    return;
                }
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;35mEDITSNIPE[0m

[2;34m[${edited.author}][0m [${edited.authorId}]
Old: ${edited.oldContent}
New: ${edited.newContent}
\`\`\``);
                break;

            case 'purge':
                if (!args[0]) {
                    await message.edit('Please provide a number of messages to purge (e.g., >purge 2)');
                    return;
                }
                const amount = parseInt(args[0]);
                if (isNaN(amount) || amount < 1 || amount > 100) {
                    await message.edit('Please provide a number between 1 and 100');
                    return;
                }
                try {
                    const messages = await message.channel.messages.fetch({ limit: amount });
                    const ownMessages = messages.filter(msg => msg.author.id === client.user.id);
                    for (const msg of ownMessages.values()) {
                        await msg.delete();
                    }
                    await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mPURGED![0m

[2;35mPurged [0m[2;31m${ownMessages.size}[0m[2;35m of your messages[0m
\`\`\``);
                } catch (error) {
                    console.error(`Purge error at ${new Date().toISOString()}:`, error);
                    await message.edit('Failed to purge messages. Please check permissions or try again');
                }
                break;

            case 'setprefix':
                if (!args[0]) {
                    await message.edit('Please provide a new prefix (e.g., >setprefix !)');
                    return;
                }
                COMMAND_PREFIX = args[0];
                await message.edit(`\
\`\`\`ansi
[2;34m[UMXRRS SB][0m [2;37m--[0m[2;45m[2;32mPREFIX SET![0m

[2;35mNew prefix: [0m[2;31m${COMMAND_PREFIX}[0m
\`\`\``);
                break;

            default:
                await message.edit(`Unknown command: ${command}. Use ${COMMAND_PREFIX}menu to see available categories`);
                break;
        }
    } catch (error) {
        console.error(`Command error at ${new Date().toISOString()}:`, error);
        await message.edit(`Error: ${error.message || 'An unexpected error occurred.'}`);
    }
});

client.on('error', (error) => {
    console.error(`Client error at ${new Date().toISOString()}:`, error);
});

client.login(USER_TOKEN).catch((error) => {
    console.error(`Login failed at ${new Date().toISOString()}:`, error);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    client.destroy();
    process.exit(0);
});