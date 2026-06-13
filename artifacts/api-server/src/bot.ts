import {
  Client,
  Collection,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
  GuildMember,
  PermissionFlagsBits,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Interaction,
  MessageFlags,
  ChannelType,
  Guild,
  OverwriteType,
} from "discord.js";
import { XMLParser } from "fast-xml-parser";
import { parse as parseHtml } from "node-html-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = process.env["DISCORD_BOT_TOKEN"];
const welcomeChannelId = process.env["DISCORD_WELCOME_CHANNEL_ID"];
const newsChannelId = process.env["DISCORD_NEWS_CHANNEL_ID"];

if (!token) throw new Error("DISCORD_BOT_TOKEN is not set.");
if (!welcomeChannelId) throw new Error("DISCORD_WELCOME_CHANNEL_ID is not set.");
if (!newsChannelId) throw new Error("DISCORD_NEWS_CHANNEL_ID is not set.");

// ── Channel / Category IDs ──────────────────────────────────────────────────
const HONEYPOT_CHANNEL_ID          = "1515016512849842256";
const HERO_LEADERBOARD_CHANNEL_ID  = "1515022455289417970";
const VILLAIN_LEADERBOARD_CHANNEL_ID = "1515022516085592064";
const SHOP_CHANNEL_ID              = "1515214274329579580";
const BOSS_CATEGORY_ID             = "1515214001720660058";
const QUARANTINE_CATEGORY_ID       = "1515237253025366066";
const INFECTED_LOUNGE_ID           = "1515237318749851698";
const BYPASS_SHOP_CHANNEL_ID       = "1515237359392788601";
const PESETAS_LB_CHANNEL_ID        = "1515244481589411871";
const WEAPON_INFO_CHANNEL_ID       = "1515246349363449896";
const SERVER_GUIDE_CHANNEL_ID      = "1515004712229802025";

// ── Support / Ticket IDs ─────────────────────────────────────────────────────
const SUPPORT_CATEGORY_ID     = "1515329539574861854";
const TICKET_PANEL_CHANNEL_ID = "1515329765408509952";
const SUPPORT_STAFF_ROLE_ID   = "1515330084398039120";

// ── Role IDs ────────────────────────────────────────────────────────────────
const SURVIVOR_ROLE_ID   = "1515239131175845948";
const BOSS_FIGHT_ROLE_ID = "1515239894941696111";
const DEAD_ROLE_ID       = "1515239336847605850";

// ── Fixed message IDs (edit-in-place, never repost) ─────────────────────────
const HERO_LEADERBOARD_MSG_ID   = "1515025600408977499";
const VILLAIN_LEADERBOARD_MSG_ID = "1515025602216857804";
const SHOP_MSG_ID               = "1515216540297990174";

// ── File paths — all persistent data lives in src/ ──────────────────────────
const SRC_DIR               = path.join(__dirname, "..", "src");
const HONEYPOT_BEAR_TRAP_PATH = path.join(__dirname, "bear-trap.png");
const RE4_LOGO_PATH           = path.join(__dirname, "re4-logo.png");
const MERCHANT_IMAGE_PATH     = path.join(__dirname, "merchant.png");

const VILLAIN_IMAGE_PATHS: Record<string, string> = {
  "Victor Gideon":   path.join(__dirname, "villain-victor-gideon.png"),
  "Albert Wesker":   path.join(__dirname, "villain-albert-wesker.png"),
  "Mother Miranda":  path.join(__dirname, "villain-mother-miranda.png"),
  "Lady Dimitrescu": path.join(__dirname, "villain-lady-dimitrescu.png"),
  "Zeno":            path.join(__dirname, "villain-zeno.png"),
  "Osmund Saddler":  path.join(__dirname, "villain-osmund-saddler.png"),
};

function villainImageFilename(name: string): string {
  return `villain-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
}

function buildVillainImageFile(name: string): AttachmentBuilder | null {
  const p = VILLAIN_IMAGE_PATHS[name];
  if (!p || !fs.existsSync(p)) return null;
  return new AttachmentBuilder(p, { name: villainImageFilename(name) });
}

function getTopVillain(votes: Record<string, string[]>): string | undefined {
  const totals = getTotals(votes, VILLAINS);
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];
}
const POSTED_URLS_FILE        = path.join(SRC_DIR, "posted-urls.json");
const HERO_VOTES_FILE         = path.join(SRC_DIR, "leaderboard-votes.json");
const VILLAIN_VOTES_FILE      = path.join(SRC_DIR, "villain-leaderboard-votes.json");
const HONEYPOT_MSG_ID_FILE    = path.join(SRC_DIR, "honeypot-msg-id.json");
const GAME_DATA_FILE          = path.join(SRC_DIR, "resident_evil_game.json");
const DEAD_ROLE_TIMERS_FILE   = path.join(SRC_DIR, "dead-role-timers.json");
const BYPASS_MSG_ID_FILE      = path.join(SRC_DIR, "bypass-shop-msg-id.json");
const PESETAS_LB_MSG_ID_FILE  = path.join(SRC_DIR, "pesetas-lb-msg-id.json");
const WEAPON_INFO_MSG_ID_FILE  = path.join(SRC_DIR, "weapon-info-msg-id.json");
const SERVER_GUIDE_MSG_ID_FILE = path.join(SRC_DIR, "server-guide-msg-id.json");
const TICKET_PANEL_MSG_ID_FILE = path.join(SRC_DIR, "ticket-panel-msg-id.json");

// ── Intervals ────────────────────────────────────────────────────────────────
const NEWS_INTERVAL_MS       = 12 * 60 * 60 * 1000;
const SHOP_INTERVAL_MS       = 10 * 60 * 1000;
const CHAT_EARN_COOLDOWN_MS  = 60 * 1000;
const BOSS_FIGHT_DURATION_MS    = 60 * 1000;
const DEAD_ROLE_EXPIRY_MS       = 24 * 60 * 60 * 1000;
const BOSS_AUTO_SPAWN_MIN_MS    = 2 * 60 * 60 * 1000;
const BOSS_AUTO_SPAWN_MAX_MS    = 6 * 60 * 60 * 1000;
const PESETAS_LB_INTERVAL_MS    = 5 * 60 * 1000;

// ── Honeypot whitelist ───────────────────────────────────────────────────────
const SAFE_USER_IDS = new Set(["774943684646666260", "862948496440819772"]);

// Only these two users can manually trigger !bossspawn / !bossend
const BOSS_SPAWN_ALLOWED_IDS = new Set(["774943684646666260", "862948496440819772"]);

// ── News feeds ───────────────────────────────────────────────────────────────
const NEWS_FEEDS = [
  // Google News dynamic search — always fresh, largest pool
  "https://news.google.com/rss/search?q=resident+evil&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=resident+evil+capcom&hl=en-US&gl=US&ceid=US:en",
  // Reddit communities
  "https://www.reddit.com/r/residentevil/.rss",
  "https://www.reddit.com/r/residentevil4/.rss",
  "https://www.reddit.com/r/REBHFun/.rss",
  // Gaming outlets
  "https://www.eurogamer.net/rss",
  "https://feeds.ign.com/ign/news",
  "https://www.gamesradar.com/rss/",
  "https://kotaku.com/rss",
  "https://www.destructoid.com/feed/",
  "https://www.vg247.com/feed",
  "https://www.gameinformer.com/rss.xml",
  "https://www.polygon.com/rss/index.xml",
];

// Only remember the last N posts — no permanent blacklist, always finds fresh content
const MAX_RECENT_POSTS = 10;

const NEWS_KEYWORDS = /resident evil|biohazard|re4|re2|re3|re village|re:?4|re:?2|re:?3|capcom survival|ashley|leon kennedy|claire redfield|ada wong|umbrella corp/i;

// ============================================================
// MERCHANT WEAPON MASTER POOL
// ============================================================
interface Weapon {
  name: string;
  damage_multiplier: number;
  price: number;
  tier: "high" | "mid" | "low";
}

const HIGH_TIER: Weapon[] = [
  { name: "Infinite Rocket Launcher",  damage_multiplier: 5000, price: 2000000, tier: "high" },
  { name: "Chicago Sweeper (SMG)",     damage_multiplier: 1800, price:  650000, tier: "high" },
  { name: "Handcannon (.50 Magnum)",   damage_multiplier: 2500, price:  530000, tier: "high" },
  { name: "Killer7 (Magnum)",          damage_multiplier: 2200, price:   77700, tier: "high" },
];

const MID_TIER: Weapon[] = [
  { name: "LE 5 (SMG)",                damage_multiplier:  900, price:  273000, tier: "mid" },
  { name: "CQBR Assault Rifle",        damage_multiplier: 1300, price:   28000, tier: "mid" },
  { name: "Stingray (Semi-Auto Rifle)",damage_multiplier: 1100, price:   30000, tier: "mid" },
  { name: "Riot Shotgun",              damage_multiplier: 1200, price:   28000, tier: "mid" },
  { name: "W-870 Shotgun",             damage_multiplier: 1000, price:   12000, tier: "mid" },
];

const LOW_TIER: Weapon[] = [
  { name: "Matilda (Burst Handgun)",      damage_multiplier: 450, price: 298000, tier: "low" },
  { name: "Red9 (High-Power Handgun)",    damage_multiplier: 600, price: 284000, tier: "low" },
  { name: "Primal Knife",                 damage_multiplier: 200, price: 250000, tier: "low" },
  { name: "Silver Ghost (Handgun)",       damage_multiplier: 400, price: 224000, tier: "low" },
  { name: "Punisher (Handgun)",           damage_multiplier: 350, price: 209000, tier: "low" },
];

const QUARANTINE_PASS = { name: "Quarantine Bypass Pass", price: 50000 };

// ── Weapon role names (exact Discord role names the bot will create/manage) ──
const WEAPON_ROLES: Record<string, string> = {
  "Infinite Rocket Launcher":   "Weapon: Infinite Rocket Launcher",
  "Chicago Sweeper (SMG)":      "Weapon: Chicago Sweeper",
  "Handcannon (.50 Magnum)":    "Weapon: Handcannon",
  "Killer7 (Magnum)":           "Weapon: Killer7",
  "LE 5 (SMG)":                 "Weapon: LE 5",
  "CQBR Assault Rifle":         "Weapon: CQBR Assault Rifle",
  "Stingray (Semi-Auto Rifle)": "Weapon: Stingray",
  "Riot Shotgun":               "Weapon: Riot Shotgun",
  "W-870 Shotgun":              "Weapon: W-870 Shotgun",
  "Matilda (Burst Handgun)":    "Weapon: Matilda",
  "Red9 (High-Power Handgun)":  "Weapon: Red9",
  "Primal Knife":               "Weapon: Primal Knife",
  "Silver Ghost (Handgun)":     "Weapon: Silver Ghost",
  "Punisher (Handgun)":         "Weapon: Punisher",
};

// Populated on startup by ensureWeaponRoles(): weaponName → Discord role ID
const weaponRoleCache = new Map<string, string>();

// Look up the damage value for a weapon by its exact name
const ALL_WEAPONS = [...HIGH_TIER, ...MID_TIER, ...LOW_TIER];
function weaponDamage(name: string): number {
  return ALL_WEAPONS.find((w) => w.name === name)?.damage_multiplier ?? 0;
}
function weaponTier(name: string): "high" | "mid" | "low" | null {
  return ALL_WEAPONS.find((w) => w.name === name)?.tier ?? null;
}

function weaponToId(name: string): string {
  return name.toLowerCase().replace(/\(.+\)/g, "").replace(/[^a-z0-9]/g, " ").trim().replace(/\s+/g, "-");
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeapon(pool: Weapon[]): Weapon {
  return pool[randInt(0, pool.length - 1)];
}

function generateShopStock(): { weapon: Weapon; price: number }[] {
  const hasHigh = Math.random() < 0.10;
  const stock: { weapon: Weapon; price: number }[] = [];
  if (hasHigh) {
    const w = pickWeapon(HIGH_TIER);
    stock.push({ weapon: w, price: w.price });
  }
  const mid = pickWeapon(MID_TIER);
  const low = pickWeapon(LOW_TIER);
  stock.push({ weapon: mid, price: mid.price });
  stock.push({ weapon: low, price: low.price });
  return stock;
}

function buildShopEmbed(stock: { weapon: Weapon; price: number }[]): EmbedBuilder {
  let desc =
    `> "Heh-heh-heh... Welcome, stranger! Got some rare selection of goods on sale today. Weapons ain't just tools, mate... they're a way of life!"\n` +
    `> \n` +
    `> **[CURRENT 10-MINUTE STOCK]**\n`;
  for (const item of stock) {
    desc += `> \uD83D\uDFE3 **[${item.weapon.name}]** \u2014 \`[${item.price.toLocaleString()}]\` Pesetas (\`${item.weapon.damage_multiplier}\` damage)\n`;
  }
  desc += `> \uD83C\uDF9F\uFE0F **Quarantine Bypass Pass** \u2014 \`[${QUARANTINE_PASS.price.toLocaleString()}]\` Pesetas\n`;
  desc += `> \n> "What're ya buyin', stranger? Make your choice quickly... time is a luxury you don't have out here."`;

  return new EmbedBuilder()
    .setColor(0x800080)
    .setTitle("THE MERCHANT'S WEAPONRY & SUPPLY TERMINAL")
    .setDescription(desc)
    .setImage("attachment://merchant.png")
    .setFooter({ text: "THE MERCHANT \u2014 STRANGER'S TERMINAL" });
}

function buildShopRows(stock: { weapon: Weapon; price: number }[]): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < stock.length; i++) {
    const label = `Buy ${stock[i].weapon.name}`;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_${i}`)
        .setLabel(label.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_${stock.length}`)
      .setLabel("Buy Quarantine Pass")
      .setStyle(ButtonStyle.Primary)
  );
  return [row];
}

// ============================================================
// GAME DATA / ECONOMY
// ============================================================
interface GameWeapon {
  id: string;
  name: string;
  damage_multiplier: number;
}

interface UserProfile {
  pesetas: number;
  current_weapons: GameWeapon[];
  quarantine_pass: boolean;
  _lastEarnTime?: number;
}

interface GameData {
  users: Record<string, UserProfile>;
}

function loadGameData(): GameData {
  try {
    if (fs.existsSync(GAME_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(GAME_DATA_FILE, "utf8"));
    }
  } catch {}
  return { users: {} };
}

function saveGameData(data: GameData) {
  fs.writeFileSync(GAME_DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function loadUserProfile(userId: string): UserProfile {
  const data = loadGameData();
  if (!data.users[userId]) {
    data.users[userId] = { pesetas: 0, current_weapons: [], quarantine_pass: false };
    saveGameData(data);
  }
  return data.users[userId];
}

function saveUserProfile(userId: string, profile: UserProfile) {
  const data = loadGameData();
  data.users[userId] = profile;
  saveGameData(data);
}

// ============================================================
// BOSS FIGHT
// ============================================================
const BOSS_POOL = [
  "Albert Wesker",
  "Mother Miranda",
  "Victor Gideon",
  "Zeno",
  "Lady Dimitrescu",
  "Osmund Saddler",
];

const BOSS_HP_RANGES: Record<string, [number, number]> = {
  "Zeno":             [15000,  25000],
  "Lady Dimitrescu":  [30000,  45000],
  "Victor Gideon":    [35000,  50000],
  "Mother Miranda":   [40000,  60000],
  "Osmund Saddler":   [45000,  65000],
  "Albert Wesker":    [50000,  75000],
};

interface BossState {
  bossName: string;
  channelId: string;
  hp: number;
  maxHp: number;
  guildId: string;
  participants: Set<string>;
  participantBestDamage: Map<string, number>;
  ended: boolean;
  timer: NodeJS.Timeout | null;
}

let activeBoss: BossState | null = null;
let nextSpawnAt: number = Date.now() + 60_000; // updated by scheduleNextBossSpawn

function updateBotPresence() {
  if (!client.user) return;
  if (activeBoss && !activeBoss.ended) {
    client.user.setPresence({
      activities: [{ name: "⚠️ BOSS ALERT: Active Combat Arena!", type: ActivityType.Playing }],
      status: "online",
    });
  } else {
    const minsLeft = Math.max(0, Math.round((nextSpawnAt - Date.now()) / 60_000));
    const text = minsLeft > 0 ? `Next boss fight in ${minsLeft} minutes` : "Scanning for Biohazards...";
    client.user.setPresence({
      activities: [{ name: text, type: ActivityType.Watching }],
      status: "online",
    });
  }
}

interface DeadRoleTimer {
  userId: string;
  assignedAt: number;
}

function loadDeadRoleTimers(): DeadRoleTimer[] {
  try {
    if (fs.existsSync(DEAD_ROLE_TIMERS_FILE)) {
      return JSON.parse(fs.readFileSync(DEAD_ROLE_TIMERS_FILE, "utf8"));
    }
  } catch {}
  return [];
}

function saveDeadRoleTimers(timers: DeadRoleTimer[]) {
  fs.writeFileSync(DEAD_ROLE_TIMERS_FILE, JSON.stringify(timers, null, 2), "utf8");
}

function buildBossEmbed(bossName: string, hp: number, maxHp: number): EmbedBuilder {
  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  const bars = Math.round(pct / 5);
  const hpBar = "█".repeat(bars) + "░".repeat(20 - bars);
  const status = hp <= 0 ? "💀 ELIMINATED" : hp < maxHp * 0.25 ? "⚠️ CRITICAL" : "🔴 ACTIVE";

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`☣️ BOSS ENCOUNTER — ${bossName.toUpperCase()}`)
    .setDescription(
      `> **[BIOWEAPON ALERT — ACTIVE ENGAGEMENT]**\n` +
      `> \n` +
      `> **STATUS:** ${status}\n` +
      `> **HP:** \`[${hp.toLocaleString()} / ${maxHp.toLocaleString()}]\`\n` +
      `> \`[${hpBar}]\` ${pct}%\n` +
      `> \n` +
      `> Click **⚔️ Attack!** to deal damage using your equipped weapon.\n` +
      `> Players with no weapon deal **50** base damage.\n` +
      `> \n` +
      `> ⏱️ **You have 60 seconds. Coordinate your fire — or face quarantine.**`
    )
    .setFooter({ text: "UMBRELLA COMBAT DIRECTIVE — ACTIVE BOSS CHANNEL" });

  if (VILLAIN_IMAGE_PATHS[bossName]) {
    embed.setImage(`attachment://${villainImageFilename(bossName)}`);
  }

  return embed;
}

// ── Create / cache all weapon roles on the guild ─────────────────────────────
async function ensureWeaponRoles(guild: Guild) {
  const existingRoles = await guild.roles.fetch();
  for (const [weaponName, roleName] of Object.entries(WEAPON_ROLES)) {
    let role = existingRoles.find((r) => r.name === roleName);
    if (!role) {
      try {
        role = await guild.roles.create({ name: roleName, reason: "Weapon role system" });
        console.log(`[WeaponRoles] Created role: ${roleName}`);
      } catch (err) {
        console.error(`[WeaponRoles] Failed to create role "${roleName}":`, err);
        continue;
      }
    }
    weaponRoleCache.set(weaponName, role.id);
  }
  console.log(`[WeaponRoles] ${weaponRoleCache.size} weapon roles ready.`);
}

// ── Determine tier distribution of a set of guild members ────────────────────
function detectRoomTier(members: Collection<string, GuildMember>): "high" | "mid" | "low" | "none" {
  let highCount = 0, midCount = 0, lowCount = 0;
  for (const [, member] of members) {
    if (member.user.bot) continue;
    for (const [weaponName, roleId] of weaponRoleCache) {
      if (!member.roles.cache.has(roleId)) continue;
      const t = weaponTier(weaponName);
      if (t === "high") { highCount++; break; }
      if (t === "mid")  { midCount++;  break; }
      if (t === "low")  { lowCount++;  break; }
    }
  }
  if (highCount > 0)                        return "high";
  if (midCount > 0 && midCount >= lowCount) return "mid";
  if (lowCount > 0)                         return "low";
  return "none";
}

async function spawnBoss(guild: Guild) {
  if (activeBoss && !activeBoss.ended) {
    console.log("[Boss] Boss already active, ignoring spawn.");
    return;
  }

  const bossName = BOSS_POOL[Math.floor(Math.random() * BOSS_POOL.length)];
  const [hpMin, hpMax] = BOSS_HP_RANGES[bossName] ?? [30000, 50000];
  const rawMaxHp = randInt(hpMin, hpMax);

  // Dynamic scaling based on weapon tiers held by active Survivor members
  let members: Collection<string, GuildMember>;
  try { members = await guild.members.fetch(); } catch { members = guild.members.cache; }
  const survivorMembers = members.filter((m) => !m.user.bot && m.roles.cache.has(SURVIVOR_ROLE_ID));
  const roomTier = detectRoomTier(survivorMembers);
  const scaleMap: Record<string, number> = { high: 1.0, mid: 0.50, low: 0.15, none: 0.04 };
  const scaleFactor = scaleMap[roomTier] ?? 0.04;
  const maxHp = Math.max(200, Math.round(rawMaxHp * scaleFactor));
  console.log(`[Boss] Modifier Applied: Room tier="${roomTier}" → scaled HP ${rawMaxHp.toLocaleString()} × ${scaleFactor} = ${maxHp.toLocaleString()}`);
  const channelName = bossName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  let bossChannel: TextChannel;
  try {
    bossChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: BOSS_CATEGORY_ID,
      reason: `Boss fight: ${bossName}`,
      permissionOverwrites: [
        // Lock out everyone by default
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        // Only Boss Fight role holders can see and chat in the arena
        {
          id: BOSS_FIGHT_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    }) as TextChannel;
  } catch (err) {
    console.error("[Boss] Failed to create boss channel:", err);
    return;
  }

  activeBoss = {
    bossName,
    channelId: bossChannel.id,
    hp: maxHp,
    maxHp,
    guildId: guild.id,
    participants: new Set(),
    participantBestDamage: new Map(),
    ended: false,
    timer: null,
  };

  // Assign Boss Fight Role to ALL non-bot, non-Dead members and strip Survivor role for the fight.
  // We do NOT filter by Survivor role here — members who joined before the bot was live
  // may not have Survivor yet, and we still want them to participate.
  try {
    const freshMembers = await guild.members.fetch();
    let assigned = 0;
    for (const [, member] of freshMembers) {
      if (member.user.bot) continue;
      if (member.roles.cache.has(DEAD_ROLE_ID)) continue; // quarantined players sit out
      await member.roles.remove(SURVIVOR_ROLE_ID, "Boss fight started").catch(() => {});
      await member.roles.add(BOSS_FIGHT_ROLE_ID, "Boss fight initiated").catch(() => {});
      assigned++;
    }
    console.log(`[Boss] Boss Fight Role assigned to ${assigned} member(s). Survivor role removed during fight.`);
  } catch (err) {
    console.error("[Boss] Failed to assign boss fight roles:", err);
  }

  const embed = buildBossEmbed(bossName, maxHp, maxHp);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("boss_attack").setLabel("⚔️ Attack!").setStyle(ButtonStyle.Danger)
  );
  const bossImgFile = buildVillainImageFile(bossName);

  await bossChannel.send({
    content: `@here\n**⚠️ BOSS ALERT — ${bossName.toUpperCase()} HAS APPEARED!**`,
    embeds: [embed],
    components: [row],
    ...(bossImgFile ? { files: [bossImgFile] } : {}),
  });

  console.log(`[Boss] SPAWNED: ${bossName} | Channel: ${bossChannel.id} | HP: ${maxHp}`);
  updateBotPresence();

  activeBoss.timer = setTimeout(() => {
    void bossDefeat(guild, "timeout");
  }, BOSS_FIGHT_DURATION_MS);
}

function calcBossReward(bestDamage: number): number {
  if (bestDamage >= 1301) return randInt(100000, 200000); // high tier
  if (bestDamage >= 601)  return randInt(50000,  100000); // mid tier
  if (bestDamage >= 51)   return randInt(15000,  50000);  // low tier
  return randInt(5000, 15000);                            // base (no weapon)
}

async function bossVictory(guild: Guild) {
  if (!activeBoss || activeBoss.ended) return;
  activeBoss.ended = true;
  if (activeBoss.timer) clearTimeout(activeBoss.timer);

  const { bossName, channelId, participants, participantBestDamage } = activeBoss;
  activeBoss = null;

  // Award Pesetas scaled by each participant's best weapon damage
  for (const userId of participants) {
    const bestDamage = participantBestDamage.get(userId) ?? 50;
    const reward = calcBossReward(bestDamage);
    const profile = loadUserProfile(userId);
    profile.pesetas += reward;
    saveUserProfile(userId, profile);
    console.log(`[Boss] Rewarded ${userId}: ${reward.toLocaleString()} Pesetas (best damage: ${bestDamage})`);
  }

  // Strip Boss Fight Role and restore Survivor Role for all holders
  try {
    const members = await guild.members.fetch();
    for (const [, member] of members) {
      if (member.roles.cache.has(BOSS_FIGHT_ROLE_ID)) {
        await member.roles.remove(BOSS_FIGHT_ROLE_ID, "Boss fight ended: victory").catch(() => {});
        await member.roles.add(SURVIVOR_ROLE_ID, "Boss fight ended: victory — restored").catch(() => {});
      }
    }
  } catch {}

  // Delete boss channel
  try {
    const ch = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete("Boss fight ended: victory");
  } catch {}

  console.log(`[Boss] VICTORY: ${bossName} defeated. ${participants.size} player(s) rewarded (tiered Pesetas).`);
  updateBotPresence();
}

async function bossDefeat(guild: Guild, _reason: "timeout" | "admin") {
  if (!activeBoss || activeBoss.ended) return;
  activeBoss.ended = true;
  if (activeBoss.timer) clearTimeout(activeBoss.timer);

  const { bossName, channelId } = activeBoss;
  activeBoss = null;

  const deadTimers = loadDeadRoleTimers();

  // Strip Boss Fight Role + Survivor Role, assign Dead Role to all boss fight role holders
  try {
    const members = await guild.members.fetch();
    for (const [memberId, member] of members) {
      if (!member.roles.cache.has(BOSS_FIGHT_ROLE_ID)) continue;
      await member.roles.remove(BOSS_FIGHT_ROLE_ID, "Boss fight ended: defeat").catch(() => {});
      await member.roles.remove(SURVIVOR_ROLE_ID, "Boss fight defeat").catch(() => {});
      await member.roles.add(DEAD_ROLE_ID, "Boss fight defeat").catch(() => {});

      const now = Date.now();
      const existing = deadTimers.findIndex((t) => t.userId === memberId);
      if (existing >= 0) deadTimers[existing].assignedAt = now;
      else deadTimers.push({ userId: memberId, assignedAt: now });

      scheduleDeadRoleRelease(guild, memberId, now);
    }
  } catch (err) {
    console.error("[Boss] Failed to assign dead roles:", err);
  }

  saveDeadRoleTimers(deadTimers);

  // Delete boss channel
  try {
    const ch = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete("Boss fight ended: defeat");
  } catch {}

  console.log(`[Boss] DEFEAT: ${bossName} survived. Players quarantined for 24h.`);
  updateBotPresence();
}

function scheduleNextBossSpawn(guild: Guild) {
  const delay = randInt(BOSS_AUTO_SPAWN_MIN_MS, BOSS_AUTO_SPAWN_MAX_MS);
  const mins = Math.round(delay / 60000);
  nextSpawnAt = Date.now() + delay;
  console.log(`[Boss] Next auto-spawn in ${mins} minutes.`);
  updateBotPresence();
  setTimeout(async () => {
    if (!activeBoss || activeBoss.ended) {
      await spawnBoss(guild);
    }
    scheduleNextBossSpawn(guild);
  }, delay);
}

function scheduleDeadRoleRelease(guild: Guild, userId: string, assignedAt: number) {
  const remaining = Math.max(0, assignedAt + DEAD_ROLE_EXPIRY_MS - Date.now());
  setTimeout(async () => {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.roles.cache.has(DEAD_ROLE_ID)) {
        await member.roles.remove(DEAD_ROLE_ID, "24h quarantine expired").catch(() => {});
        await member.roles.add(SURVIVOR_ROLE_ID, "24h quarantine expired").catch(() => {});
        console.log(`[Boss] Auto-released ${userId} from quarantine after 24h.`);
      }
    } catch {}
    const timers = loadDeadRoleTimers().filter((t) => t.userId !== userId);
    saveDeadRoleTimers(timers);
  }, remaining);
}

// ============================================================
// HEROES / VILLAINS
// ============================================================
const HEROES = [
  "Leon S. Kennedy", "Chris Redfield", "Jill Valentine", "Claire Redfield",
  "Ada Wong", "Rebecca Chambers", "Barry Burton", "Sherry Birkin",
  "Carlos Oliveira", "Sheva Alomar", "Jake Muller", "Helena Harper",
  "Ethan Winters", "Mia Winters", "Rosemary Winters", "Billy Coen",
  "Piers Nivans", "Moira Burton", "Zoe Baker", "HUNK",
];

const VILLAINS = [
  "Albert Wesker", "Nemesis", "William Birkin", "Osmund Saddler",
  "Jack Baker", "Lady Dimitrescu", "Mother Miranda", "Alexia Ashford",
  "Alfred Ashford", "Jack Krauser", "Ramon Salazar", "Bitores Mendez",
  "Excella Gionne", "Alex Wesker", "Glenn Arias", "Lucas Baker",
  "Eveline", "Karl Heisenberg", "Donna Beneviento", "Salvatore Moreau",
];

const LOCALE_FLAG: Record<string, string> = {
  "en-US": "\uD83C\uDDFA\uD83C\uDDF8", "en-GB": "\uD83C\uDDEC\uD83C\uDDE7", "en-AU": "\uD83C\uDDE6\uD83C\uDDFA", "en-CA": "\uD83C\uDDE8\uD83C\uDDE6",
  "fr": "\uD83C\uDDEB\uD83C\uDDF7", "de": "\uD83C\uDDE9\uD83C\uDDEA", "es": "\uD83C\uDDEA\uD83C\uDDF8", "es-419": "\uD83C\uDDF2\uD83C\uDDFD",
  "pt-BR": "\uD83C\uDDE7\uD83C\uDDF7", "pt": "\uD83C\uDDF5\uD83C\uDDF9", "it": "\uD83C\uDDEE\uD83C\uDDF9", "nl": "\uD83C\uDDF3\uD83C\uDDF1",
  "ru": "\uD83C\uDDF7\uD83C\uDDFA", "pl": "\uD83C\uDDF5\uD83C\uDDF1", "uk": "\uD83C\uDDFA\uD83C\uDDE6", "tr": "\uD83C\uDDF9\uD83C\uDDF7",
  "ja": "\uD83C\uDDEF\uD83C\uDDF5", "ko": "\uD83C\uDDF0\uD83C\uDDF7", "zh-CN": "\uD83C\uDDE8\uD83C\uDDF3", "zh-TW": "\uD83C\uDDF9\uD83C\uDDFC",
  "ar": "\uD83C\uDDF8\uD83C\uDDE6", "hi": "\uD83C\uDDEE\uD83C\uDDF3", "th": "\uD83C\uDDF9\uD83C\uDDED", "vi": "\uD83C\uDDFB\uD83C\uDDF3",
  "id": "\uD83C\uDDEE\uD83C\uDDE9", "sv": "\uD83C\uDDF8\uD83C\uDDEA", "da": "\uD83C\uDDE9\uD83C\uDDF0", "fi": "\uD83C\uDDEB\uD83C\uDDEE",
  "nb": "\uD83C\uDDF3\uD83C\uDDF4", "el": "\uD83C\uDDEC\uD83C\uDDF7", "ro": "\uD83C\uDDF7\uD83C\uDDF4", "cs": "\uD83C\uDDE8\uD83C\uDDFF",
  "hu": "\uD83C\uDDED\uD83C\uDDFA", "bg": "\uD83C\uDDE7\uD83C\uDDEC", "hr": "\uD83C\uDDED\uD83C\uDDF7", "sk": "\uD83C\uDDF8\uD83C\uDDF0",
  "lt": "\uD83C\uDDF1\uD83C\uDDF9", "sl": "\uD83C\uDDF8\uD83C\uDDEE",
};

function getFlagForMember(member: GuildMember): string {
  const locale = (member.user as any).locale as string | undefined;
  if (!locale) return "";
  return LOCALE_FLAG[locale] ?? LOCALE_FLAG[locale.split("-")[0]] ?? "";
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
});

// ============================================================
// JSON HELPERS
// ============================================================
// Loads the last N posted URLs — no permanent blacklist
function loadPostedUrls(): string[] {
  try {
    if (!fs.existsSync(POSTED_URLS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(POSTED_URLS_FILE, "utf8"));
    // Support old formats: string[] or PostedEntry[]
    const arr: string[] = Array.isArray(raw)
      ? raw.map((x: string | { url: string }) =>
          typeof x === "string" ? x : x?.url ?? ""
        ).filter(Boolean)
      : [];
    return arr.slice(-MAX_RECENT_POSTS);
  } catch {}
  return [];
}

// Appends a new URL and keeps only the last MAX_RECENT_POSTS
function appendPostedUrl(url: string) {
  const recent = loadPostedUrls();
  const updated = [...recent.filter((u) => u !== url), url].slice(-MAX_RECENT_POSTS);
  fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify(updated), "utf8");
}

function savePostedUrls(_urls: Set<string>) {
  // No-op shim kept for !clearnews compatibility — use appendPostedUrl for new posts
  fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify([]), "utf8");
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function loadVotes(file: string): Record<string, string[]> {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}
  return {};
}

function saveVotes(file: string, votes: Record<string, string[]>) {
  fs.writeFileSync(file, JSON.stringify(votes, null, 2), "utf8");
}

function getTotals(votes: Record<string, string[]>, roster: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const name of roster) totals[name] = 0;
  for (const userVotes of Object.values(votes)) {
    for (const name of userVotes) {
      if (totals[name] !== undefined) totals[name]++;
    }
  }
  return totals;
}

function loadPersistentMsgId(file: string): string | null {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return null;
}

function savePersistentMsgId(file: string, id: string) {
  fs.writeFileSync(file, JSON.stringify(id), "utf8");
}

// ============================================================
// EMBED BUILDERS
// ============================================================
function buildRows(roster: string[], prefix: string): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < roster.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let j = i; j < i + 5 && j < roster.length; j++) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`${prefix}_${j}`).setLabel(roster[j]).setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildHeroEmbed(votes: Record<string, string[]>): EmbedBuilder {
  const totals = getTotals(votes, HEROES);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const [first, second, third, ...rest] = sorted;

  let desc =
    `> **[CURRENT POPULATION METRICS]**\n` +
    `> Cast your votes using the network terminal array below. You are authorized to select exactly three (3) distinct hero profiles. Clicking an active selection will retract your vote.\n` +
    `> \n> **[TOP RATED EXPERIMENTS]**\n`;
  if (first)  desc += `> \uD83E\uDD47 **1st Place:** ${first[0]} \u2014 \`[${first[1]}]\` Transmissions\n`;
  if (second) desc += `> \uD83E\uDD48 **2nd Place:** ${second[0]} \u2014 \`[${second[1]}]\` Transmissions\n`;
  if (third)  desc += `> \uD83E\uDD49 **3rd Place:** ${third[0]} \u2014 \`[${third[1]}]\` Transmissions\n`;
  desc += `> \n> **[REMAINING DATA POOL]**\n`;
  for (const [name, count] of rest) desc += `> * ${name}: \`[${count}]\` votes\n`;

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("UMBRELLA MAINFRAME - GLOBAL BIOMETRIC PREFERENCE LOG")
    .setDescription(desc)
    .setFooter({ text: "UMBRELLA MAINFRAME \u2014 CAST YOUR VOTE" });
}

function buildVillainEmbed(votes: Record<string, string[]>, topVillain?: string): EmbedBuilder {
  const totals = getTotals(votes, VILLAINS);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const [first, second, third, ...rest] = sorted;

  let desc =
    `> **[CURRENT MUTATION METRICS]**\n` +
    `> Cast your votes using the network terminal array below. You are authorized to select exactly one (1) distinct villain profile. Clicking an active selection will retract your threat logging.\n` +
    `> \n> **[TOP RATED BIOWEAPONS]**\n`;
  if (first)  desc += `> \uD83E\uDD47 **1st Place:** ${first[0]} \u2014 \`[${first[1]}]\` Transmissions\n`;
  if (second) desc += `> \uD83E\uDD48 **2nd Place:** ${second[0]} \u2014 \`[${second[1]}]\` Transmissions\n`;
  if (third)  desc += `> \uD83E\uDD49 **3rd Place:** ${third[0]} \u2014 \`[${third[1]}]\` Transmissions\n`;
  desc += `> \n> **[REMAINING THREAT POOL]**\n`;
  for (const [name, count] of rest) desc += `> * ${name}: \`[${count}]\` votes\n`;

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("UMBRELLA MAINFRAME - THREAT LEVEL & MUTATION LOG")
    .setDescription(desc)
    .setFooter({ text: "UMBRELLA MAINFRAME \u2014 CAST YOUR THREAT ASSESSMENT" });
}

function buildHoneypotEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("\u26A0\uFE0F SYSTEM WARNING \u2014 SECURITY CONTAINMENT ZONE")
    .setImage("attachment://bear-trap.png")
    .setDescription(
      `> **[SYSTEM WARNING / SECURITY PROTOCOL]**\n` +
      `> This channel is a security containment zone. Hacked accounts and automated spam bots translate scripts here. If you post or upload anything in this channel, you will be instantly and permanently banned.\n` +
      `> \n> **[MULTILINGUAL WARNING DETECTIONS]**\n` +
      `> \uD83C\uDDEA\uD83C\uDDF8 **ES:** Este canal es una trampa. Si p\u00FAblicas algo aqu\u00ED, ser\u00E1s baneado permanentemente.\n` +
      `> \uD83C\uDDEB\uD83C\uDDF7 **FR:** Ce salon est un pi\u00E8ge. Si vous publiez quoi que ce soit ici, vous serez banni d\u00E9finitivement.\n` +
      `> \uD83C\uDDE9\uD83C\uDDEA **DE:** Dieser Kanal ist eine Falle. Wenn Sie hier etwas posten, werden Sie permanent gebannt.\n` +
      `> \uD83C\uDDF5\uD83C\uDDF9 **PT:** Este canal \u00E9 uma armadilha. Se voc\u00EA postar algo aqui, ser\u00E1 banido permanentemente.\n` +
      `> \uD83C\uDDEE\uD83C\uDDF9 **IT:** Questo canale \u00E8 una trappola. Se pubblichi qualcosa qui, sarai bandito permanentemente.\n` +
      `> \uD83C\uDDF7\uD83C\uDDFA **RU:** \u042D\u0442\u043E\u0442 \u043A\u0430\u043D\u0430\u043B \u2014 \u043B\u043E\u0432\u0443\u0448\u043A\u0430. \u0415\u0441\u043B\u0438 \u0432\u044B \u0447\u0442\u043E-\u0442\u043E \u043E\u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442\u0435 \u0437\u0434\u0435\u0441\u044C, \u0432\u044B \u0431\u0443\u0434\u0435\u0442\u0435 \u0437\u0430\u0431\u0430\u043D\u0435\u043D\u044B \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430.\n` +
      `> \uD83C\uDDE8\uD83C\uDDF3 **ZH:** \u8FD9\u4E2A\u9891\u9053\u662F\u4E00\u4E2A\u9677\u9631\u3002\u5982\u679C\u4F60\u5728\u8FD9\u91CC\u53D1\u5E03\u4EFB\u4F55\u4E1C\u897F\uFF0C\u4F60\u5C06\u88AB\u6C38\u4E45\u5C01\u7981\u3002\n` +
      `> \uD83C\uDDEF\uD83C\uDDF5 **JA:** \u3053\u306E\u30C1\u30E3\u30F3\u30CD\u30EB\u306F\u7F60\u3067\u3059\u3002\u3053\u3053\u306B\u4F55\u304B\u3092\u6295\u7A3F\u3059\u308B\u3068\u3001\u6C38\u4E45\u306B BAN \u3055\u308C\u307E\u3059\u3002\n` +
      `> \uD83C\uDDF0\uD83C\uDDF7 **KO:** \uC774 \uCC44\uB110\uC740 \uD568\uC815\uC785\uB2C8\uB2E4. \uC5EC\uAE30\uC5D0 \uAE00\uC744 \uAC8C\uC2DC\uD558\uBA74 \uC601\uAD6C \uCC28\uB2E8\uB429\uB2C8\uB2E4.\n` +
      `> \uD83C\uDDF8\uD83C\uDDE6 **AR:** \u0647\u0630\u0647 \u0627\u0644\u0642\u0646\u0627\u0629 \u0641\u062E. \u0625\u0630\u0627 \u0642\u0645\u062A \u0628\u0646\u0634\u0631 \u0623\u064A \u0634\u064A\u0621 \u0647\u0646\u0627\u060C \u0641\u0633\u064A\u062A\u0645 \u062D\u0638\u0631\u0643 \u0646\u0647\u0627\u0626\u064A\u064B\u0627.\n` +
      `> \uD83C\uDDEE\uD83C\uDDF3 **HI:** \u092F\u0939 \u091A\u0948\u0928\u0932 \u090F\u0915 \u091C\u093E\u0932 \u0939\u0948\u0964 \u092F\u0926\u093F \u0906\u092A \u092F\u0939\u093E\u0901 \u0915\u0941\u091B \u092D\u0940 \u092A\u094B\u0938\u094D\u091F \u0915\u0930\u0924\u0947 \u0939\u0948\u0902, \u0924\u094B \u0906\u092A\u0915\u094B \u0938\u094D\u0925\u093E\u092F\u0940 \u0930\u0942\u092A \u0938\u0947 \u092A\u094D\u0930\u0924\u093F\u092C\u0902\u0927\u093F\u0924 \u0915\u0930 \u0926\u093F\u092F\u093E \u091C\u093E\u090F\u0917\u093E\u0964\n` +
      `> \uD83C\uDDF9\uD83C\uDDF7 **TR:** Bu kanal bir tuzakt\u0131r. Buraya bir \u015Fey g\u00F6nderirseniz kal\u0131c\u0131 olarak engellenirsiniz.\n` +
      `> \uD83C\uDDFB\uD83C\uDDF3 **VI:** K\u00EAnh n\u00E0y l\u00E0 m\u1ED9t c\u00E1i b\u1EABy. N\u1EBFu b\u1EA1n \u0111\u0103ng b\u1EA5t c\u1EE9 \u0111i\u1EC1u g\u00EC \u1EDF \u0111\u00E2y, b\u1EA1n s\u1EBD b\u1ECB c\u1EA5m v\u0129nh vi\u1EC5n.\n` +
      `> \uD83C\uDDF5\uD83C\uDDF1 **PL:** Ten kana\u0142 to pu\u0142apka. Je\u015Bli co\u015B tu opublikujesz, zostaniesz permanentnie zbanowany.\n` +
      `> \uD83C\uDDF3\uD83C\uDDF1 **NL:** Dit kanaal is een valstrik. Als je hier iets plaatst, word je permanent verbannen.\n` +
      `> \uD83C\uDDEE\uD83C\uDDE9 **ID:** Saluran ini adalah jebakan. Jika Anda mengirimkan sesuatu di sini, Anda akan dibanned permanen.\n` +
      `> \uD83C\uDDF9\uD83C\uDDED **TH:** \u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E35\u0E48\u0E14\u0E31\u0E01 \u0E2B\u0E32\u0E01\u0E04\u0E38\u0E13\u0E42\u0E1E\u0E2A\u0E15\u0E4C\u0E2A\u0E34\u0E48\u0E07\u0E43\u0E14\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E04\u0E38\u0E13\u0E08\u0E30\u0E16\u0E39\u0E01\u0E41\u0E1A\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E16\u0E32\u0E27\u0E23\n` +
      `> \uD83C\uDDFA\uD83C\uDDE6 **UK:** \u0426\u0435\u0439 \u043A\u0430\u043D\u0430\u043B \u2014 \u043F\u0430\u0441\u0442\u043A\u0430. \u042F\u043A\u0449\u043E \u0432\u0438 \u0449\u043E\u0441\u044C \u043E\u043F\u0443\u0431\u043B\u0456\u043A\u0443\u0454\u0442\u0435 \u0442\u0443\u0442, \u0432\u0430\u0441 \u0437\u0430\u0431\u0430\u043D\u044F\u0442\u044C \u043D\u0430\u0437\u0430\u0432\u0436\u0434\u0438.\n` +
      `> \n> **[TRANSLATION TOOL DEPLOYMENT]**\n` +
      `> If your language is not displayed above, utilize the external mainframe interface:\n` +
      `> [Execute External Google Translation Mainframe](https://translate.google.com/)`
    )
    .setFooter({ text: "UMBRELLA SECURITY NETWORK \u2014 AUTOMATED LOCKDOWN SYSTEM" });
}

function buildBypassShopEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("🔓 QUARANTINE BYPASS — MERCHANT TERMINAL")
    .setDescription(
      `> **[QUARANTINE RELEASE PROTOCOL]**\n` +
      `> If you have purchased a **Quarantine Bypass Pass** from the Merchant, click the button below to restore your server access.\n` +
      `> \n` +
      `> 🟢 **Have a Pass:** Your Dead Role will be stripped and Survivor access restored immediately.\n` +
      `> 🔴 **No Pass:** Grind Pesetas in <#${INFECTED_LOUNGE_ID}> and purchase one from the Merchant shop.\n` +
      `> \n` +
      `> *Passes are purchased in the Merchant terminal. Survivors without a pass must wait 24h for automatic release.*`
    )
    .setFooter({ text: "UMBRELLA QUARANTINE CONTROL — BYPASS TERMINAL" });
}

function buildServerGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("📝 RESIDENT EVIL COMMUNITY — SERVER MASTER GUIDE")
    .setDescription(
      "*Welcome to the Resident Evil Community. Below is everything you need to know about how the economy, boss spawns, weapons, and quarantine systems work.*"
    )
    .addFields(
      {
        name: "💰 EARNING PESETAS",
        value:
          "> **Active Chatting:** Type descriptive text actions in the main chat channels to earn between **50 – 150 Pesetas** per message.\n" +
          "> **Anti-Spam Cooldown:** You can only earn money once every 30–60 seconds. Spamming will trigger a hidden error message.",
        inline: false,
      },
      {
        name: "🚨 RANDOM BOSS SPAWNS & LOCKDOWN",
        value:
          "> **The Spawn:** Bosses will spawn at random. A brand-new channel named after the boss is created automatically.\n" +
          "> **The Lockdown:** The moment a boss spawns, you receive the <@&" + BOSS_FIGHT_ROLE_ID + "> role — instantly hiding all other channels so you can only see the boss arena.\n" +
          "> **The Fight:** You have exactly **1 minute** to click the UI weapon buttons and lower the boss's random health pool to 0.",
        inline: false,
      },
      {
        name: "🥇 VICTORY — If You Win",
        value:
          "> The group earns a massive prize of **100,000 – 200,000 Pesetas**.\n" +
          "> The boss channel is deleted, your <@&" + BOSS_FIGHT_ROLE_ID + "> role is removed, and all regular channels return.",
        inline: false,
      },
      {
        name: "💀 DEFEAT — If You Lose (Time Runs Out)",
        value:
          "> The boss channel is deleted and your normal access role is stripped.\n" +
          "> You receive the <@&" + DEAD_ROLE_ID + "> role — exiling you to <#" + INFECTED_LOUNGE_ID + "> inside the quarantine zone.\n" +
          "> **Escape:** Head to <#" + BYPASS_SHOP_CHANNEL_ID + "> and buy a **Bypass Pass** with your Pesetas to remove the <@&" + DEAD_ROLE_ID + "> role.\n" +
          "> **Safety Release:** Can't afford it? You're automatically freed after **24 hours**.",
        inline: false,
      },
      {
        name: "🛒 WEAPONS, AMMO & STATS",
        value:
          "> Check <#" + WEAPON_INFO_CHANNEL_ID + "> for prices, damage multipliers, ammo types, and drop chances for all High, Mid, and Low-tier gear.\n" +
          "> Use your saved Pesetas to upgrade your weapons and kill higher-tier bosses faster.",
        inline: false,
      },
      {
        name: "📊 TOP 10 LEADERBOARD",
        value:
          "> The live board in <#" + PESETAS_LB_CHANNEL_ID + "> displays the top 10 richest survivors holding the most Pesetas.\n" +
          "> The bot updates this automatically and mentions you directly if you break into the top 10.",
        inline: false,
      },
      {
        name: "🔍 PLAYER PROFILE COMMAND",
        value:
          "> **`!info @mention`**\n" +
          "> View any player's server join date, active roles, viewing permission status, wallet balance, and weapon inventory.",
        inline: false,
      },
      {
        name: "🎫 SUPPORT & REPORTS",
        value:
          "> Need help, want to report a player, or have a suggestion? Head to <#" + TICKET_PANEL_CHANNEL_ID + "> and open a ticket.\n" +
          "> **Bug Report** — something broken in the bot or server.\n" +
          "> **Player Report** — report rule-breaking behaviour with evidence.\n" +
          "> **Idea / Suggestion** — pitch a feature or improvement.\n" +
          "> A private channel is created instantly — only you and staff can see it. Click **🔒 Close Ticket** when done.",
        inline: false,
      }
    )
    .setFooter({ text: "RESIDENT EVIL COMMUNITY — UMBRELLA CORPORATION INTEL DIVISION" })
    .setTimestamp();
}

async function updateServerGuide() {
  const embed = buildServerGuideEmbed();
  const existingId = loadPersistentMsgId(SERVER_GUIDE_MSG_ID_FILE);

  if (existingId) {
    try {
      const channel = await client.channels.fetch(SERVER_GUIDE_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds: [embed] });
      console.log(`[ServerGuide] Updated guide embed. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error("[ServerGuide] Failed to edit:", err); return; }
      console.log("[ServerGuide] Message gone. Posting new one...");
    }
  }

  try {
    const channel = await client.channels.fetch(SERVER_GUIDE_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds: [embed] });
    savePersistentMsgId(SERVER_GUIDE_MSG_ID_FILE, msg.id);
    console.log(`[ServerGuide] Guide posted. ID: ${msg.id}`);
  } catch (err) { console.error("[ServerGuide] Failed to post:", err); }
}

function buildWeaponInfoEmbeds(): EmbedBuilder[] {
  const W = (name: string, role: string, price: string, dmg: number, drop: string, ammo: string) =>
    `• **\`${name.toUpperCase()}\`**\n  ↳ Role: ${role}\n  ↳ Price: ${price} Pesetas | Damage: ${dmg}\n  ↳ Drop Chance: ${drop} | Ammo: ${ammo}`;

  const high = new EmbedBuilder()
    .setColor(0x4a154b)
    .setTitle("UMBRELLA CORPORATION — WEAPON & AMMUNITION REGISTRY")
    .setDescription(
      "Purchasing a weapon from the shop automatically grants you its associated role.\n" +
      "You cannot use a weapon button in a boss fight unless you own that weapon's role.\n\u200b"
    )
    .addFields({
      name: "🔴  HIGH-TIER WEAPONS",
      value: [
        W("Infinite Rocket Launcher", "Weapon: Infinite Rocket Launcher", "2,000,000", 5000, "0.5%",  "Infinite Rockets"),
        W("Chicago Sweeper (SMG)",    "Weapon: Chicago Sweeper",           "650,000",   1800, "2.0%",  "Submachine Gun Ammo"),
        W("Handcannon (.50 Magnum)",  "Weapon: Handcannon",                "530,000",   2500, "1.5%",  "Magnum Ammo"),
        W("Killer7 (Magnum)",         "Weapon: Killer7",                   "77,700",    2200, "5.0%",  "Magnum Ammo"),
      ].join("\n\n"),
      inline: false,
    })
    .setFooter({ text: "UMBRELLA CORPORATION — CLASSIFIED WEAPONS DATABASE" });

  const mid = new EmbedBuilder()
    .setColor(0x4a154b)
    .addFields({
      name: "🟢  MID-TIER WEAPONS",
      value: [
        W("LE 5 (SMG)",                "Weapon: LE 5",            "273,000", 900,  "10.0%", "Submachine Gun Ammo"),
        W("CQBR Assault Rifle",        "Weapon: CQBR Assault Rifle","28,000", 1300, "12.0%", "Rifle Ammo"),
        W("Stingray (Semi-Auto Rifle)", "Weapon: Stingray",         "30,000", 1100, "15.0%", "Rifle Ammo"),
        W("Riot Shotgun",              "Weapon: Riot Shotgun",      "28,000", 1200, "15.0%", "Shotgun Shells"),
        W("W-870 Shotgun",             "Weapon: W-870 Shotgun",     "12,000", 1000, "20.0%", "Shotgun Shells"),
      ].join("\n\n"),
      inline: false,
    })
    .setFooter({ text: "UMBRELLA CORPORATION — CLASSIFIED WEAPONS DATABASE" });

  const low = new EmbedBuilder()
    .setColor(0x4a154b)
    .addFields(
      {
        name: "🔵  LOW-TIER WEAPONS",
        value: [
          W("Matilda (Burst Handgun)",   "Weapon: Matilda",       "298,000", 450, "25.0%",         "Handgun Ammo"),
          W("Red9 (High-Power Handgun)", "Weapon: Red9",          "284,000", 600, "25.0%",         "Handgun Ammo"),
          W("Primal Knife",              "Weapon: Primal Knife",  "250,000", 200, "35.0%",         "Infinite (No Ammo)"),
          W("Silver Ghost (Handgun)",    "Weapon: Silver Ghost",  "224,000", 400, "Starter Weapon", "Handgun Ammo"),
          W("Punisher (Handgun)",        "Weapon: Punisher",      "209,000", 350, "30.0%",         "Handgun Ammo"),
        ].join("\n\n"),
        inline: false,
      },
      {
        name: "\u200b",
        value: "⚠️ **System Notice:** Purchasing a weapon from the shop automatically grants you its associated role. You cannot use a weapon button in a boss fight unless you own that weapon's role.",
        inline: false,
      }
    )
    .setFooter({ text: "UMBRELLA CORPORATION — CLASSIFIED WEAPONS DATABASE" });

  return [high, mid, low];
}

async function updateWeaponInfo() {
  console.log("[WeaponInfo] Action Taken: Generating static Weapon & Ammo reference list → Target: Channel ID 1515246349363449896 | Design: Embed Color #4A154B / Printing Drop Chances and Stats");

  const embeds = buildWeaponInfoEmbeds();
  const existingId = loadPersistentMsgId(WEAPON_INFO_MSG_ID_FILE);

  if (existingId) {
    try {
      const channel = await client.channels.fetch(WEAPON_INFO_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds });
      console.log(`[WeaponInfo] Updated weapon info embed. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error("[WeaponInfo] Failed to edit:", err); return; }
      console.log("[WeaponInfo] Message gone. Posting new one...");
    }
  }

  try {
    const channel = await client.channels.fetch(WEAPON_INFO_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds });
    savePersistentMsgId(WEAPON_INFO_MSG_ID_FILE, msg.id);
    console.log(`[WeaponInfo] Weapon info posted. ID: ${msg.id}`);
  } catch (err) { console.error("[WeaponInfo] Failed to post:", err); }
}

function buildPesetasLeaderboardEmbed(top10: { userId: string; pesetas: number }[]): EmbedBuilder {
  const medals = ["🥇", "🥈", "🥉"];
  let desc = `> **[CURRENT ECONOMY RANKINGS]**\n> Top 10 survivors ranked by accumulated Pesetas.\n> \n`;

  if (!top10.length) {
    desc += `> *No economy data yet. Start chatting to earn Pesetas!*`;
  } else {
    for (let i = 0; i < top10.length; i++) {
      const { userId, pesetas } = top10[i];
      const medal = medals[i] ?? `**#${i + 1}**`;
      desc += `> ${medal} <@${userId}> \u2014 \`[${pesetas.toLocaleString()}]\` Pesetas\n`;
    }
  }

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("🏆 Top 10 Survivors Leaderboard")
    .setDescription(desc)
    .setTimestamp()
    .setFooter({ text: "UMBRELLA MAINFRAME \u2014 ECONOMY RANKINGS \u2022 Updates every 5 minutes" });
}

async function updatePesetasLeaderboard() {
  console.log("[Leaderboard] Refreshing Top 10 Rankings → Channel ID 1515244481589411871 | Hex #FF0000 | Rendering Player Mentions and Balances");

  const data = loadGameData();
  const sorted = Object.entries(data.users)
    .map(([userId, profile]) => ({ userId, pesetas: profile.pesetas }))
    .filter((u) => u.pesetas > 0)
    .sort((a, b) => b.pesetas - a.pesetas)
    .slice(0, 10);

  const embed = buildPesetasLeaderboardEmbed(sorted);
  const existingId = loadPersistentMsgId(PESETAS_LB_MSG_ID_FILE);

  if (existingId) {
    try {
      const channel = await client.channels.fetch(PESETAS_LB_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds: [embed] });
      console.log(`[Leaderboard] Updated Pesetas leaderboard. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error("[Leaderboard] Failed to edit:", err); return; }
      console.log("[Leaderboard] Message gone. Posting new one...");
    }
  }

  try {
    const channel = await client.channels.fetch(PESETAS_LB_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds: [embed] });
    savePersistentMsgId(PESETAS_LB_MSG_ID_FILE, msg.id);
    console.log(`[Leaderboard] Pesetas leaderboard posted. ID: ${msg.id}`);
  } catch (err) { console.error("[Leaderboard] Failed to post:", err); }
}

function buildWelcomeEmbed(member: GuildMember): EmbedBuilder {
  const count = member.guild.memberCount;
  const flag = getFlagForMember(member);
  const flagPrefix = flag ? `${flag} ` : "";
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`${flagPrefix}Survivor #${count}`)
    .setThumbnail(member.displayAvatarURL({ size: 512 }))
    .setImage("attachment://re4-logo.png")
    .setDescription(
      `> **STATUS: NEW SURVIVOR DETECTED**\n` +
      `> Welcome to the server, <@${member.id}>. You have just entered the containment zone.\n` +
      `> \n> **FIRST PROTOCOLS:**\n` +
      `> 1. Head over to the rules channel and read the server protocols. Breaking them gets you removed. <#1514949694730670190>\n` +
      `> 2. Read through the guide channel <#1515004712229802025> to understand how the outbreak mechanics, economy, and bot features work.\n` +
      `> 3. Check the announcements channel <#1514949694730670191> to see current server events.\n` +
      `> 4. You can start chatting here <#1514949694730670195>.`
    );
}

// ============================================================
// EDIT HELPERS
// ============================================================
async function editExistingMessage(
  channelId: string,
  msgId: string,
  embed: EmbedBuilder,
  rows: ActionRowBuilder<ButtonBuilder>[],
  files?: AttachmentBuilder[]
) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof (channel as any).messages !== "object") return;
    const msg = await (channel as TextChannel).messages.fetch(msgId);
    if (!msg) return;
    const payload: any = { embeds: [embed], components: rows, attachments: [] };
    if (files?.length) payload.files = files;
    await msg.edit(payload);
    console.log(`[Edit] Updated message ${msgId} in channel ${channelId}.`);
  } catch (err) {
    console.error(`[Edit] Failed to update ${msgId}:`, err);
  }
}

// ============================================================
// NEWS
// ============================================================
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const root = parseHtml(html);
    const img =
      root.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      root.querySelector('meta[name="twitter:image:src"]')?.getAttribute("content") ||
      root.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
      null;
    if (img && img.startsWith("http")) return img;
    return null;
  } catch { return null; }
}

function buildSummaryFromDescription(rawDesc: string, title: string): string {
  const clean = rawDesc
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
  if (!clean || clean === title) return `> *${title}*`;
  const words = clean.split(" ");
  let result = "";
  let lineLen = 0;
  const lines: string[] = [];
  for (const w of words) {
    if (lineLen + w.length + 1 > 60) { lines.push(result.trim()); result = ""; lineLen = 0; }
    result += " " + w;
    lineLen += w.length + 1;
  }
  if (result.trim()) lines.push(result.trim());
  return lines.slice(0, 12).map((l) => `> ${l.trim()}`).join("\n");
}

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  "media:content"?: { "@_url"?: string } | Array<{ "@_url"?: string }>;
  "media:thumbnail"?: { "@_url"?: string };
  enclosure?: { "@_url"?: string };
}

function extractRssImage(item: RssItem): string | null {
  const mc = item["media:content"];
  if (mc) {
    if (Array.isArray(mc)) { const url = mc[0]?.["@_url"]; if (url?.startsWith("http")) return url; }
    else { const url = (mc as { "@_url"?: string })["@_url"]; if (url?.startsWith("http")) return url; }
  }
  const mt = item["media:thumbnail"]?.["@_url"];
  if (mt?.startsWith("http")) return mt;
  const enc = item.enclosure?.["@_url"];
  if (enc?.startsWith("http")) return enc;
  return null;
}

async function fetchFeedItems(feedUrl: string): Promise<RssItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(text);
    return parsed?.rss?.channel?.item ?? [];
  } catch (err) {
    console.error(`[News] Failed to fetch ${feedUrl}:`, err);
    return [];
  }
}

async function fetchAndBroadcastNews() {
  console.log("[News] Checking for Resident Evil news...");
  const channel = await client.channels.fetch(newsChannelId!).catch(() => null);
  if (!channel || typeof (channel as any).send !== "function") {
    console.error("[News] News channel not found or unsendable.");
    return;
  }

  // Only skip articles posted in the last MAX_RECENT_POSTS — no permanent blacklist
  const recentUrls = new Set(loadPostedUrls());
  const allItems: RssItem[] = [];
  for (const feedUrl of NEWS_FEEDS) {
    const items = await fetchFeedItems(feedUrl);
    allItems.push(...items.filter((i) => NEWS_KEYWORDS.test(i.title || "") || NEWS_KEYWORDS.test(i.description || "")));
  }

  if (!allItems.length) { console.log("[News] No RE articles found."); return; }

  // Shuffle so a different article surfaces every time
  for (let i = allItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
  }

  console.log(`[News] ${allItems.length} RE articles found, ${recentUrls.size} recently posted.`);

  let posted = 0;
  for (const item of allItems) {
    if (posted >= 1) break;
    const rawUrl = typeof item.link === "string" ? item.link : String(item.link ?? "");
    if (!rawUrl) continue;
    const url = normalizeUrl(rawUrl);
    if (recentUrls.has(url)) continue; // skip only if posted in last 10

    const title = item.title?.replace(/ - .*$/, "").trim() || "Resident Evil News";
    const pubDate = item.pubDate ? new Date(item.pubDate).toUTCString() : "";
    let imageUrl = extractRssImage(item);
    if (!imageUrl) imageUrl = await fetchOgImage(rawUrl);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`\uD83D\uDCE1 ${title}`)
      .setURL(rawUrl)
      .setDescription(
        `> **\u2014 INCOMING TRANSMISSION \u2014**\n> \n` +
        buildSummaryFromDescription(item.description || title, title) +
        `\n> \n> **SOURCE:** [Read full article](${rawUrl})\n` +
        (pubDate ? `> **BROADCAST TIME:** ${pubDate}` : "")
      )
      .setFooter({ text: "UMBRELLA INTEL NETWORK \u2014 AUTO-BROADCAST" });

    if (imageUrl) embed.setImage(imageUrl);

    try {
      await (channel as TextChannel).send({ embeds: [embed] });
      appendPostedUrl(url); // remember only last 10
      console.log(`[News] Broadcast: ${title}`);
      posted++;
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error("[News] Failed to send embed:", err);
    }
  }

  if (posted === 0) console.log("[News] No new articles (all recent results already posted).");
  else console.log(`[News] Broadcast ${posted} article(s).`);
}

// ============================================================
// PERSISTENT EMBED HELPERS
// ============================================================
async function updateHoneypotWarning() {
  const existingId = loadPersistentMsgId(HONEYPOT_MSG_ID_FILE);
  const embed = buildHoneypotEmbed();
  const files = [new AttachmentBuilder(HONEYPOT_BEAR_TRAP_PATH, { name: "bear-trap.png" })];

  if (existingId) {
    try {
      const channel = await client.channels.fetch(HONEYPOT_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds: [embed], files });
      console.log(`[Honeypot] Warning embed updated. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error(`[Honeypot] Failed to edit:`, err); return; }
      console.log(`[Honeypot] Existing message gone. Posting new one...`);
    }
  }

  try {
    const channel = await client.channels.fetch(HONEYPOT_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds: [embed], files });
    savePersistentMsgId(HONEYPOT_MSG_ID_FILE, msg.id);
    console.log(`[Honeypot] Warning embed posted. ID: ${msg.id}`);
  } catch (err) { console.error("[Honeypot] Failed to post:", err); }
}

async function updateBypassShop() {
  const existingId = loadPersistentMsgId(BYPASS_MSG_ID_FILE);
  const embed = buildBypassShopEmbed();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("buy_bypass").setLabel("🔓 Use Bypass Pass").setStyle(ButtonStyle.Success)
  );

  if (existingId) {
    try {
      const channel = await client.channels.fetch(BYPASS_SHOP_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds: [embed], components: [row] });
      console.log(`[Bypass] Shop embed updated. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error(`[Bypass] Failed to edit:`, err); return; }
      console.log(`[Bypass] Existing message gone. Posting new one...`);
    }
  }

  try {
    const channel = await client.channels.fetch(BYPASS_SHOP_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    savePersistentMsgId(BYPASS_MSG_ID_FILE, msg.id);
    console.log(`[Bypass] Shop embed posted. ID: ${msg.id}`);
  } catch (err) { console.error("[Bypass] Failed to post:", err); }
}

async function updateHeroLeaderboard() {
  const votes = loadVotes(HERO_VOTES_FILE);
  await editExistingMessage(HERO_LEADERBOARD_CHANNEL_ID, HERO_LEADERBOARD_MSG_ID, buildHeroEmbed(votes), buildRows(HEROES, "hero"));
  console.log("[Heroes] Leaderboard updated.");
}

async function updateVillainLeaderboard() {
  const votes = loadVotes(VILLAIN_VOTES_FILE);
  await editExistingMessage(VILLAIN_LEADERBOARD_CHANNEL_ID, VILLAIN_LEADERBOARD_MSG_ID, buildVillainEmbed(votes), buildRows(VILLAINS, "villain"));
  console.log("[Villains] Leaderboard updated.");
}

// ============================================================
// TICKET SYSTEM
// ============================================================
function buildTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle("☣️ UMBRELLA CORPORATION — SUPPORT DIVISION")
    .setDescription(
      "> **Need assistance, survivor?**\n" +
      "> Select the appropriate category below to open a support ticket.\n" +
      "> Our staff will respond as soon as possible.\n" +
      "> \n" +
      "> ⚠️ **One active ticket per user.** Resolve your current ticket before opening a new one."
    )
    .addFields(
      { name: "🐛 Found bugs/glitches in bot", value: "> Report broken commands, economy errors, or bot malfunctions.", inline: false },
      { name: "🚨 Report anyone", value: "> Submit a report against a user for rule violations or suspicious activity.", inline: false },
      { name: "💡 Ideas & Suggestions", value: "> Share your ideas to improve the server or bot features.", inline: false },
    )
    .setFooter({ text: "UMBRELLA SUPPORT DIVISION — CLASSIFIED TICKET SYSTEM" })
    .setTimestamp();
}

function buildTicketSelectRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("☣️ Select a ticket category...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Found bugs/glitches in bot")
        .setDescription("Report broken commands, economy errors, or bot malfunctions.")
        .setValue("bug")
        .setEmoji("🐛"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Report anyone")
        .setDescription("Report a user for rule violations or suspicious activity.")
        .setValue("report")
        .setEmoji("🚨"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ideas & Suggestions")
        .setDescription("Share your ideas to improve the server or bot features.")
        .setValue("idea")
        .setEmoji("💡"),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function buildTicketWelcomeEmbed(type: string, user: { id: string; username: string }): EmbedBuilder {
  const labels: Record<string, string> = {
    bug: "🐛 Bug / Glitch Report",
    report: "🚨 User Report",
    idea: "💡 Idea & Suggestion",
  };
  const instructions: Record<string, string> = {
    bug: "Please describe the bug or glitch in detail. Include what command or feature is broken and what you expected to happen.",
    report: "Please provide the username or mention of the person you are reporting, along with evidence and a description of the incident.",
    idea: "Please describe your idea or suggestion in detail. Explain how it would benefit the server or improve the bot.",
  };
  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle(`${labels[type] ?? "Support Ticket"} — CASE OPENED`)
    .setDescription(
      `> **Ticket Owner:** <@${user.id}>\n` +
      `> **Status:** 🟢 Open — Awaiting Staff Response\n` +
      `> \n` +
      `> **Instructions:**\n` +
      `> ${instructions[type] ?? "Please describe your issue."}\n` +
      `> \n` +
      `> <@&${SUPPORT_STAFF_ROLE_ID}> — A ticket has been opened.`
    )
    .setFooter({ text: "UMBRELLA SUPPORT DIVISION — Click 🔒 Close Ticket when resolved." })
    .setTimestamp();
}

function buildTicketCloseRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );
}

async function updateTicketPanel() {
  const embed = buildTicketPanelEmbed();
  const row = buildTicketSelectRow();
  const existingId = loadPersistentMsgId(TICKET_PANEL_MSG_ID_FILE);

  if (existingId) {
    try {
      const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
      if (!channel || typeof (channel as any).messages !== "object") return;
      const msg = await (channel as TextChannel).messages.fetch(existingId);
      await msg.edit({ embeds: [embed], components: [row as any] });
      console.log(`[Tickets] Panel updated. ID: ${existingId}`);
      return;
    } catch (err: any) {
      if (err?.code !== 10008) { console.error("[Tickets] Failed to edit panel:", err); return; }
      console.log("[Tickets] Panel gone. Posting new one...");
    }
  }

  try {
    const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
    if (!channel || typeof (channel as any).send !== "function") return;
    const msg = await (channel as TextChannel).send({ embeds: [embed], components: [row as any] });
    savePersistentMsgId(TICKET_PANEL_MSG_ID_FILE, msg.id);
    console.log(`[Tickets] Panel posted. ID: ${msg.id}`);
  } catch (err) { console.error("[Tickets] Failed to post panel:", err); }
}

// ============================================================
// SHOP
// ============================================================
let currentShopStock: { weapon: Weapon; price: number }[] = [];

async function updateShop() {
  currentShopStock = generateShopStock();
  const embed = buildShopEmbed(currentShopStock);
  const rows = buildShopRows(currentShopStock);
  const files = [new AttachmentBuilder(MERCHANT_IMAGE_PATH, { name: "merchant.png" })];
  try {
    const channel = await client.channels.fetch(SHOP_CHANNEL_ID);
    if (!channel || typeof (channel as any).messages !== "object") return;
    const msg = await (channel as TextChannel).messages.fetch(SHOP_MSG_ID);
    await msg.edit({ embeds: [embed], components: rows, files });
    console.log(`[Shop] Stock rotated.`, currentShopStock.map((s) => s.weapon.name).join(", "));
  } catch (err: any) {
    if (err?.code === 10008) {
      const channel = await client.channels.fetch(SHOP_CHANNEL_ID);
      if (!channel || typeof (channel as any).send !== "function") return;
      const msg = await (channel as TextChannel).send({ embeds: [embed], components: rows, files });
      console.log(`[Shop] NEW MESSAGE POSTED. ID: ${msg.id}`);
      console.log(`[Shop] UPDATE THIS IN CODE: const SHOP_MSG_ID = "${msg.id}";`);
    } else {
      console.error(`[Shop] Failed to update:`, err);
    }
  }
}

// ============================================================
// READY
// ============================================================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // Ensure all weapon roles exist before anything else
  const guild0 = client.guilds.cache.first();
  if (guild0) await ensureWeaponRoles(guild0);

  await Promise.all([
    updateHoneypotWarning(),
    updateBypassShop(),
    updateServerGuide(),
    updateWeaponInfo(),
    updateHeroLeaderboard(),
    updateVillainLeaderboard(),
    updateShop(),
    updatePesetasLeaderboard(),
    updateTicketPanel(),
  ]);

  // Resume pending 24h dead-role timers + start auto boss spawn
  const guild = client.guilds.cache.first();
  if (guild) {
    const timers = loadDeadRoleTimers();
    for (const t of timers) {
      scheduleDeadRoleRelease(guild, t.userId, t.assignedAt);
    }
    if (timers.length) console.log(`[Boss] Resumed ${timers.length} pending quarantine timer(s).`);
    scheduleNextBossSpawn(guild);

    // Auto-assign Survivor role to any member who has no game role yet.
    // This primes existing members who joined before the bot was deployed.
    try {
      const allMembers = await guild.members.fetch();
      let primed = 0;
      for (const [, member] of allMembers) {
        if (member.user.bot) continue;
        if (member.roles.cache.has(SURVIVOR_ROLE_ID)) continue;
        if (member.roles.cache.has(DEAD_ROLE_ID)) continue;
        if (member.roles.cache.has(BOSS_FIGHT_ROLE_ID)) continue;
        await member.roles.add(SURVIVOR_ROLE_ID, "Startup: prime existing members with Survivor role").catch(() => {});
        primed++;
      }
      if (primed > 0) console.log(`[Startup] Assigned Survivor role to ${primed} existing member(s).`);
    } catch (err) {
      console.error("[Startup] Failed to prime Survivor roles:", err);
    }
  }

  // News runs on interval only — NOT on startup — to prevent repeat broadcasts on restart
  setInterval(fetchAndBroadcastNews, NEWS_INTERVAL_MS);
  setInterval(updateShop, SHOP_INTERVAL_MS);
  setInterval(updatePesetasLeaderboard, PESETAS_LB_INTERVAL_MS);

  // Dynamic bot presence — updates every 60 seconds
  updateBotPresence();
  setInterval(updateBotPresence, 60_000);
});

// ============================================================
// INTERACTIONS
// ============================================================
client.on("interactionCreate", async (interaction: Interaction) => {
  // ── String select menu — ticket creation ────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const ticketType = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;
    if (!guild) return;

    const prefixMap: Record<string, string> = { bug: "bug", report: "report", idea: "idea" };
    const prefix = prefixMap[ticketType] ?? "ticket";
    const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || user.id;
    const channelName = `${prefix}-${safeName}`;

    // One active ticket check — scan category for any channel matching user id or username
    const category = guild.channels.cache.get(SUPPORT_CATEGORY_ID);
    if (category) {
      const existing = guild.channels.cache.find(
        (ch) =>
          ch.parentId === SUPPORT_CATEGORY_ID &&
          (ch.name.endsWith(`-${safeName}`) || ch.name.includes(user.id))
      );
      if (existing) {
        await interaction.reply({
          content: `> ❌ **You already have an open ticket!** Please resolve your active ticket <#${existing.id}> before creating a new one.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: SUPPORT_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: SUPPORT_STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      });

      await ticketChannel.send({
        embeds: [buildTicketWelcomeEmbed(ticketType, user)],
        components: [buildTicketCloseRow()],
      });

      console.log(`[Tickets] Opened #${channelName} for ${user.tag} (type: ${ticketType})`);
      await interaction.reply({
        content: `> ✅ **Ticket opened!** Head to <#${ticketChannel.id}> — our staff will be with you shortly.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error("[Tickets] Failed to create ticket channel:", err);
      await interaction.reply({
        content: "> ⚠️ Failed to create your ticket. Please contact a staff member directly.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (!interaction.isButton()) return;
  const { customId, user, message } = interaction;

  // ── Ticket close ────────────────────────────────────────────
  if (customId === "ticket_close") {
    const channel = interaction.channel as TextChannel | null;
    if (!channel) return;
    const member = interaction.member as GuildMember | null;
    const isStaff = member?.roles.cache.has(SUPPORT_STAFF_ROLE_ID) ?? false;
    const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || user.id;
    const isOwner = channel.name.endsWith(`-${safeName}`) || channel.name.includes(user.id);

    if (!isStaff && !isOwner) {
      await interaction.reply({ content: "> ❌ Only the ticket owner or staff can close this ticket.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: "> 🔒 **Ticket closing...** This channel will be deleted in 5 seconds." });
    console.log(`[Tickets] Closing #${channel.name} — requested by ${user.tag}`);
    setTimeout(() => channel.delete("Ticket closed").catch(() => {}), 5000);
    return;
  }

  // ── Hero vote (max 3) ───────────────────────────────────────
  if (customId.startsWith("hero_")) {
    const idx = parseInt(customId.replace("hero_", ""), 10);
    const hero = HEROES[idx];
    if (!hero) return;

    const votes = loadVotes(HERO_VOTES_FILE);
    const userVotes = votes[user.id] ?? [];

    if (userVotes.includes(hero)) {
      votes[user.id] = userVotes.filter((h) => h !== hero);
    } else {
      if (userVotes.length >= 3) {
        await interaction.reply({ content: "> [ACCESS DENIED] You have already exhausted your 3 allocated data selections. Deselect a current vote to alter your choices.", flags: MessageFlags.Ephemeral });
        return;
      }
      votes[user.id] = [...userVotes, hero];
    }

    saveVotes(HERO_VOTES_FILE, votes);
    await message.edit({ embeds: [buildHeroEmbed(votes)], components: message.components });
    await interaction.deferUpdate();
    return;
  }

  // ── Villain vote (max 1) ────────────────────────────────────
  if (customId.startsWith("villain_")) {
    const idx = parseInt(customId.replace("villain_", ""), 10);
    const villain = VILLAINS[idx];
    if (!villain) return;

    const votes = loadVotes(VILLAIN_VOTES_FILE);
    const userVotes = votes[user.id] ?? [];

    if (userVotes.includes(villain)) {
      votes[user.id] = userVotes.filter((v) => v !== villain);
    } else {
      if (userVotes.length >= 1) {
        await interaction.reply({ content: "> [ACCESS DENIED] You have already exhausted your 1 allocated biometric selection. Deselect your current vote to alter your choice.", flags: MessageFlags.Ephemeral });
        return;
      }
      votes[user.id] = [...userVotes, villain];
    }

    saveVotes(VILLAIN_VOTES_FILE, votes);
    await message.edit({ embeds: [buildVillainEmbed(votes)], components: message.components });
    await interaction.deferUpdate();
    return;
  }

  // ── Shop purchase ───────────────────────────────────────────
  if (customId.startsWith("shop_")) {
    const idx = parseInt(customId.replace("shop_", ""), 10);
    const item = currentShopStock[idx];
    const isPass = idx === currentShopStock.length;
    if (!item && !isPass) return;

    const profile = loadUserProfile(user.id);
    const name = isPass ? QUARANTINE_PASS.name : item.weapon.name;
    const price = isPass ? QUARANTINE_PASS.price : item.price;

    if (profile.pesetas < price) {
      await interaction.reply({ content: `> ❌ Not enough Pesetas, stranger! You need \`[${price.toLocaleString()}]\` but only have \`[${profile.pesetas.toLocaleString()}]\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    profile.pesetas -= price;
    if (isPass) {
      profile.quarantine_pass = true;
    } else {
      const alreadyOwned = profile.current_weapons.some((w) => w.name === item.weapon.name);
      if (!alreadyOwned) {
        profile.current_weapons.push({ id: weaponToId(item.weapon.name), name: item.weapon.name, damage_multiplier: item.weapon.damage_multiplier });
      }
    }
    saveUserProfile(user.id, profile);

    // Award weapon Discord role if applicable
    if (!isPass && interaction.guild) {
      const weaponRoleId = weaponRoleCache.get(item.weapon.name);
      if (weaponRoleId) {
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member && !member.roles.cache.has(weaponRoleId)) {
          await member.roles.add(weaponRoleId, `Purchased ${item.weapon.name}`).catch((err) =>
            console.error(`[WeaponRoles] Failed to grant role for ${item.weapon.name}:`, err)
          );
          console.log(`[WeaponRoles] Role Execution: Granted "${WEAPON_ROLES[item.weapon.name]}" to ${user.username}.`);
        }
      }
    }

    await interaction.reply({
      content: `> **"Heh-heh-heh... good choice, stranger!"**\n> \n> You purchased **${name}** for \`[${price.toLocaleString()}]\` Pesetas.\n> Balance: \`[${profile.pesetas.toLocaleString()}]\` Pesetas.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // ── Boss attack ─────────────────────────────────────────────
  if (customId === "boss_attack") {
    if (!activeBoss || activeBoss.ended) {
      await interaction.reply({ content: "> [SYSTEM] No active boss fight.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.channelId !== activeBoss.channelId) {
      await interaction.reply({ content: "> [SYSTEM] Wrong channel.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Role-based damage: find the highest-damage weapon role the player actually holds
    const member = interaction.guild
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    let damage = 50;
    let usedWeaponName = "Base Attack";
    if (member && weaponRoleCache.size > 0) {
      for (const [weaponName, roleId] of weaponRoleCache) {
        if (member.roles.cache.has(roleId)) {
          const dmg = weaponDamage(weaponName);
          if (dmg > damage) { damage = dmg; usedWeaponName = weaponName; }
        }
      }
    }

    activeBoss.hp = Math.max(0, activeBoss.hp - damage);
    activeBoss.participants.add(user.id);
    const prevBest = activeBoss.participantBestDamage.get(user.id) ?? 0;
    if (damage > prevBest) activeBoss.participantBestDamage.set(user.id, damage);

    const bossName = activeBoss.bossName;
    const hp = activeBoss.hp;
    const maxHp = activeBoss.maxHp;

    console.log(`[Boss] Combat Log: ${user.username} used ${usedWeaponName} and dealt ${damage.toLocaleString()} damage! Boss HP Remaining: ${hp.toLocaleString()} / ${maxHp.toLocaleString()}`);

    await interaction.reply({
      content: `> ⚔️ **${user.username}** attacked **${bossName}** using **${usedWeaponName}** for **${damage.toLocaleString()} damage**!\n> Boss HP: \`[${hp.toLocaleString()} / ${maxHp.toLocaleString()}]\``,
      flags: MessageFlags.Ephemeral,
    });

    const attackImgFile = buildVillainImageFile(bossName);
    await message.edit({
      embeds: [buildBossEmbed(bossName, hp, maxHp)],
      components: message.components,
      ...(attackImgFile ? { files: [attackImgFile] } : {}),
    });

    if (hp <= 0 && interaction.guild) {
      await bossVictory(interaction.guild);
    }
    return;
  }

  // ── Quarantine bypass ───────────────────────────────────────
  if (customId === "buy_bypass") {
    const profile = loadUserProfile(user.id);
    const member = interaction.member as GuildMember | null;

    if (!profile.quarantine_pass) {
      await interaction.reply({
        content: "> ❌ You don't have a Pass. Keep grinding Pesetas in the infected lounge!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!member) {
      await interaction.reply({ content: "> ⚠️ Could not verify your server membership.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await member.roles.remove(DEAD_ROLE_ID, "Bypass pass used").catch(() => {});
      await member.roles.add(SURVIVOR_ROLE_ID, "Bypass pass used").catch(() => {});
      profile.quarantine_pass = false;
      saveUserProfile(user.id, profile);

      // Remove from dead timers if present
      const timers = loadDeadRoleTimers().filter((t) => t.userId !== user.id);
      saveDeadRoleTimers(timers);

      await interaction.reply({
        content: "> ✅ **Access Restored.** Welcome back to the surface, survivor. Your Bypass Pass has been consumed.",
        flags: MessageFlags.Ephemeral,
      });
      console.log(`[Boss] ${user.tag} used bypass pass. Released from quarantine.`);
    } catch (err) {
      console.error("[Bypass] Role update failed:", err);
      await interaction.reply({ content: "> ⚠️ Failed to update your roles. Contact an admin.", flags: MessageFlags.Ephemeral });
    }
    return;
  }
});

// ============================================================
// MESSAGES — honeypot trap + chat economy + admin commands
// ============================================================
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot) return;

  // Honeypot trap
  if (message.channelId === HONEYPOT_CHANNEL_ID) {
    if (SAFE_USER_IDS.has(message.author.id)) return;
    const member = message.member;
    if (!member) return;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

    console.log(`[Honeypot] TRIGGERED by ${message.author.tag} (${message.author.id})`);
    try {
      await message.delete().catch(() => {});
      await member.ban({ reason: "Security Trap Triggered: Compromised Account" });
      console.log(`[Honeypot] Banned: ${message.author.tag}`);
    } catch (err) { console.error("[Honeypot] Failed to ban:", err); }
    return;
  }

  // !info command — available to everyone
  if (message.content.startsWith("!info")) {
    if (!message.guild) return;

    const mention = message.mentions.users.first();
    const rawArg = message.content.split(/\s+/)[1];
    let targetMember: GuildMember | null = null;

    if (mention) {
      targetMember = await message.guild.members.fetch(mention.id).catch(() => null);
    } else if (rawArg && /^\d{17,20}$/.test(rawArg)) {
      targetMember = await message.guild.members.fetch(rawArg).catch(() => null);
    } else {
      targetMember = message.member;
    }

    if (!targetMember) {
      await message.reply("> ❌ User not found in this server.");
      return;
    }

    const u = targetMember.user;
    const profile = loadUserProfile(u.id);

    // Timestamps
    const joinedAt = targetMember.joinedAt;
    const createdAt = u.createdAt;
    const joinedStr = joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:F>` : "Unknown";
    const createdStr = `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`;

    // Role visibility status
    const hasBossRole     = targetMember.roles.cache.has(BOSS_FIGHT_ROLE_ID);
    const hasDeadRole     = targetMember.roles.cache.has(DEAD_ROLE_ID);
    const hasSurvivorRole = targetMember.roles.cache.has(SURVIVOR_ROLE_ID);
    const statusLabel = hasBossRole
      ? "⚔️ Active Combatant"
      : hasDeadRole
        ? "☠️ Infected / Quarantined"
        : hasSurvivorRole
          ? "✅ Clearance Granted"
          : "❔ Unclassified";

    // Roles list (skip @everyone)
    const roleList = targetMember.roles.cache
      .filter((r) => r.id !== message.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .join(", ") || "None";

    // Weapons
    const weapons = profile.current_weapons;
    const weaponList = weapons.length
      ? weapons.map((w) => `🔫 **${w.name}** — \`${w.damage_multiplier}\` dmg`).join("\n")
      : "None";

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`☣️ UMBRELLA DOSSIER — ${u.username.toUpperCase()}`)
      .setThumbnail(u.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "📅 Server Join Date", value: joinedStr, inline: false },
        { name: "🗓️ Account Created", value: createdStr, inline: false },
        { name: "🔐 Visibility Status", value: statusLabel, inline: false },
        { name: "🏷️ Roles", value: roleList, inline: false },
        { name: "💰 Pesetas Balance", value: `\`[${profile.pesetas.toLocaleString()}]\` Pesetas`, inline: true },
        { name: "🎫 Bypass Pass", value: profile.quarantine_pass ? "✅ Owned" : "❌ None", inline: true },
        { name: "🔫 Weapon Inventory", value: weaponList, inline: false },
      )
      .setFooter({ text: `UMBRELLA MAINFRAME — USER ID: ${u.id}` })
      .setTimestamp();

    console.log(`[Info] Command Processed: !info @${u.tag} | Database Query: Fetched Join Date, Roles, Permissions, Pesetas, and Inventory for User ID ${u.id} | Embed Generation: Rendered Red Embed (#FF0000) with complete player profile details`);
    await message.reply({ embeds: [embed] });
    return;
  }

  // Owner-only commands
  if (BOSS_SPAWN_ALLOWED_IDS.has(message.author.id)) {
    if (message.content === "!fetchnews") {
      await message.delete().catch(() => {});
      console.log(`[News] Manual fetch triggered by ${message.author.tag}`);
      await fetchAndBroadcastNews();
      return;
    }
    if (message.content === "!clearnews") {
      await message.delete().catch(() => {});
      savePostedUrls(new Set());
      console.log(`[News] Posted-URL history cleared by ${message.author.tag}`);
      return;
    }
  }

  // Boss commands — only allowed for the two owner IDs
  if (BOSS_SPAWN_ALLOWED_IDS.has(message.author.id)) {
    if (message.content === "!bossspawn") {
      if (!message.guild) return;
      await message.delete().catch(() => {});
      console.log(`[Boss] Spawn triggered by ${message.author.tag}`);
      await spawnBoss(message.guild);
      return;
    }
    if (message.content === "!bossend") {
      if (!message.guild || !activeBoss) {
        await message.reply("No active boss.").then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
        return;
      }
      await message.delete().catch(() => {});
      await bossDefeat(message.guild, "admin");
      return;
    }
  }

  // Chat economy — all non-honeypot channels
  const profile = loadUserProfile(message.author.id);
  const now = Date.now();
  const lastEarn = profile._lastEarnTime ?? 0;
  if (now - lastEarn < CHAT_EARN_COOLDOWN_MS) return;

  const earned = randInt(5, 15);
  profile.pesetas += earned;
  profile._lastEarnTime = now;
  saveUserProfile(message.author.id, profile);
  console.log(`[Economy] ${message.author.tag} earned ${earned} pesetas. Balance: ${profile.pesetas}`);
});

// ============================================================
// WELCOME
// ============================================================
client.on("guildMemberAdd", async (member) => {
  console.log(`Member joined: ${member.user.tag}`);

  // Auto-assign Survivor role to every new member
  await member.roles.add(SURVIVOR_ROLE_ID, "Auto-assign on join").catch((err) => {
    console.error(`[Welcome] Failed to assign Survivor role to ${member.user.tag}:`, err);
  });

  try {
    const channel = await client.channels.fetch(welcomeChannelId!);
    if (!channel || typeof (channel as any).send !== "function") return;
    await (channel as TextChannel).send({
      content: `<@${member.id}>`,
      embeds: [buildWelcomeEmbed(member)],
      files: [new AttachmentBuilder(RE4_LOGO_PATH, { name: "re4-logo.png" })],
    });
    console.log(`Welcome sent to ${member.user.tag} (#${member.guild.memberCount})`);
  } catch (err) { console.error("Error sending welcome embed:", err); }
});

client.login(token);
