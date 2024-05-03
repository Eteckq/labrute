/* eslint-disable max-len */
import {
  REST,
  Routes,
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  Events,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import {
  Brute, DestinyChoice, PrismaClient, User,
} from '@labrute/prisma';
import { canLevelUp, getLevelUpChoices } from '@labrute/core';
import { t } from 'i18next';
import Env from '../utils/Env.js';
import { doFight } from '../services/fights.js';
import { fcGetOpponnents } from '../services/fcGetOpponents.js';
import { LOGGER } from '../context.js';
import translate from '../utils/translate.js';
import { levelUp } from '../services/levelUp.js';

const commands = [
  {
    name: 'fight',
    description: 'Start a fight against an other brute',
  },
];

async function handleFight(prisma: PrismaClient, user: User, brute: Brute, interaction: ChatInputCommandInteraction) {
  if (brute.fightsLeft === 0) {
    await interaction.reply({
      content: 'Tu as terminé tes combats. Reviens dans quelques heures!',
      ephemeral: true,
    });
  } else {
    const opponents = await fcGetOpponnents(prisma, user, brute.name);

    if (!opponents) {
      await interaction.reply({
        content: 'Error while finding opponents',
        ephemeral: true,
      });
    } else {
      const components: ButtonBuilder[][] = [];
      const rows: any[] = [];
      if (opponents.length === 0) {
        await interaction.reply({
          content: 'Aucun adversaires disponibles',
          ephemeral: true,
        });
      } else {
        const halfwayThrough = Math.floor(opponents.length / 2);
        // or instead of floor you can use ceil depending on what side gets the extra data
        const opponentSplitted = [opponents.slice(0, halfwayThrough), opponents.slice(halfwayThrough, opponents.length)];

        for (let index = 0; index < opponentSplitted.length; index++) {
          components[index] = [];
          for (const opponent of opponentSplitted[index]) {
            const pseudo: string = (opponent as any).user ? (opponent as any).user.name : 'bot';
            components[index].push(
              new ButtonBuilder()
                .setCustomId(opponent.name)
                .setLabel(`${opponent.name} (${pseudo}) - lv${opponent.level}`)
                .setStyle(
                  (opponent as any).user ? ButtonStyle.Primary : ButtonStyle.Secondary,
                ),
            );
          }

          rows[index] = (new ActionRowBuilder().addComponents(...components[index]));
        }

        const response = await interaction.reply({
          content: 'Choisis ton adversaire',
          components: rows,
          ephemeral: true,
        });

        const collectorFilter = (i: any) => i.user.id === interaction.user.id;
        try {
          const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
          });

          try {
            const targetBrute = await prisma.brute.findFirst({
              where: {
                name: confirmation.customId,
                deletedAt: null,
              },
              select: {
                user: true,
                name: true,
                level: true,
              },
            });

            const fight = await doFight(
              prisma,
              user,
              brute.name,
              confirmation.customId,
            );
            const updatedBrute = await prisma.brute.findFirst({
              where: {
                user,
                deletedAt: null,
              },
              select: {
                xp: true,
                level: true,
                fightsLeft: true,
                id: true,
                pets: true,
                skills: true,
                weapons: true,
              },
            });
            if (updatedBrute) {
              if (canLevelUp(updatedBrute)) {
                const levelupEmbed = new EmbedBuilder()
                  .setColor(0xff00ff)
                  .setTitle('Level up!')
                  .setURL(`${Env.SELF_URL}/${brute.name}/level-up`);
                const choices = await levelUp(prisma, user, brute);

                for (let index = 0; index < choices.length; index++) {
                  const choice: DestinyChoice = choices[index];
                  let txt = '';
                  if (choice.type === 'stats' && choice.stat1) {
                    txt += `[STATS] +${choice.stat1Value} ${translate(choice.stat1, user)}`;

                    if (choice.stat2) {
                      txt += ` | +${choice.stat2Value} ${translate(choice.stat2, user)}`;
                    }
                  } else if (choice.type === 'skill' && choice.skill) {
                    txt += `[SKILL] ${t(choice.skill, { lng: 'fr' })} -> ${translate(choice.skill, user)} `;
                  }

                  const direction = index === 0 ? 'LEFT' : 'RIGHT';

                  console.log(txt, direction, user.lang);
                }

                await interaction.editReply({
                  embeds: [levelupEmbed],
                });
              }
              const fightLeft = `Il te reste encore ${
                updatedBrute.fightsLeft
              } combat${updatedBrute.fightsLeft > 1 ? 's' : ''}`;

              await interaction.editReply({
                content: `Combat lancé. ${
                  updatedBrute.fightsLeft > 0
                    ? fightLeft
                    : 'Tu as terminé tes combats. Reviens dans quelques heures!'
                }`,
                components: [],
              });
            }

            const FightEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle(`${brute.name} VS ${targetBrute?.name}`)
              .setURL(`${Env.SELF_URL}/${brute.name}/fight/${fight.id}`)
              .addFields({ name: '\u200b', value: '\u200b' })
              .addFields(
                {
                  name: `${brute.name} - lv${brute.level}`,
                  value: `<@${user.id}>`,
                  inline: true,
                },
                {
                  name: 'VS',
                  value: '\u200b',
                  inline: true,
                },
                {
                  value: `${
                    targetBrute?.user ? `<@${targetBrute.user.id}>` : 'BOT'
                  }`,
                  name: `${targetBrute?.name} - lv${targetBrute?.level}`,
                  inline: true,
                },
                { name: '\u200b', value: '\u200b' },
                {
                  name: 'Résultat',
                  value: `|| **${fight.winner}** ~~${fight.loser}~~ ||`,
                },
              )
              .setThumbnail(`${Env.SELF_URL}/images/versus/vs.png`)
              .setTimestamp();

            await confirmation.reply({ embeds: [FightEmbed] });
          } catch (error: unknown) {
            if (error instanceof Error) {
              await confirmation.update({
                content: error.message,
                components: [],
              });
            } else {
              await confirmation.update({
                content: 'Unknow error',
                components: [],
              });
            }
          }
        } catch (e) {
          await interaction.editReply({
            content: 'Aucun adversaire choisi au bout d\'une minute',
            components: [],
          });
        }
      }
    }
  }
}

async function initCmd() {
  const rest = new REST({ version: '10' }).setToken(Env.DISCORD_BOT_SECRET);
  try {
    await rest.put(Routes.applicationCommands(Env.DISCORD_CLIENT_ID), {
      body: commands,
    });
  } catch (error) {
    LOGGER.error(error);
  }
}

export default async (prisma: PrismaClient) => {
  await initCmd();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on(Events.ClientReady, () => {
    LOGGER.log(`[BOT] Logged in as ${client.user?.tag}!`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const user = await prisma.user.findFirst({
      where: {
        id: interaction.user.id,
      },
    });

    if (!user) {
      await interaction.reply({
        content: `Tu as besoin de créer une brute afin de pouvoir jouer. ${Env.SELF_URL}`,
        ephemeral: true,
      });
    } else {
      const brute = await prisma.brute.findFirst({
        where: {
          user,
          deletedAt: null,
        },
        include: {
          body: true,
          colors: true,
          opponents: {
            select: { name: true, user: true, level: true },
          },
        },
      });
      if (!brute) {
        await interaction.reply({
          content: `Tu as besoin de créer une brute afin de pouvoir jouer. ${Env.SELF_URL}`,
          ephemeral: true,
        });
      } else if (interaction.commandName === 'fight') {
        await handleFight(prisma, user, brute, interaction);
      // } else if (interaction.commandName === 'versus') {
      //   await handleVersus(prisma, user, interaction);
      }
    }
  });

  await client.login(Env.DISCORD_BOT_SECRET);
};
