/* eslint-disable max-len */
import {
  REST,
  Routes,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  SelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChatInputCommandInteraction,
  CacheType,
  ButtonInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PrismaClient } from '@labrute/prisma';
import { ExpectedError, WIN_XP, canLevelUp } from '@labrute/core';
import Env from '../utils/Env.js';
import getOpponents from '../utils/brute/getOpponents.js';
import { doFight } from '../services/fights.js';

const commands = [
  {
    name: 'fight',
    description: 'Start a fight against an other brute',
  },
];

async function initCmd() {
  const rest = new REST({ version: '10' }).setToken(Env.DISCORD_BOT_SECRET);
  try {
    await rest.put(Routes.applicationCommands(Env.DISCORD_CLIENT_ID), {
      body: commands,
    });
  } catch (error) {
    console.error(error);
  }
}

export default async (prisma: PrismaClient) => {
  await initCmd();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on(Events.ClientReady, () => {
    console.log(`[BOT] Logged in as ${client.user?.tag}!`);
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
        if (!brute.opponents) {
          await interaction.reply({
            content: 'Error while finding opponents',
            ephemeral: true,
          });
        } else {
          const components = [];
          for (const opponent of brute.opponents) {
            const pseudo = opponent.user ? opponent.user.name : 'bot';
            components.push(
              new ButtonBuilder()
                .setCustomId(opponent.name)
                .setLabel(`${opponent.name} (${pseudo}) - lv${opponent.level}`)
                .setStyle(
                  opponent.user ? ButtonStyle.Primary : ButtonStyle.Secondary,
                ),
            );
          }

          const row: any = new ActionRowBuilder().addComponents(...components);

          const response = await interaction.reply({
            content: 'Choisis ton adreversaire',
            components: [row],
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
                },
                select: {
                  xp: true,
                  level: true,
                  fightsLeft: true,
                },
              });
              if (updatedBrute) {
                if (canLevelUp(updatedBrute)) {
                  const levelupEmbed = new EmbedBuilder()
                    .setColor(0xff00ff)
                    .setTitle('Level up!')
                    .setURL(`${Env.SELF_URL}/${brute.name}/level-up`);
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
                      : 'Tu as terminé tes combats. Reviens demain!'
                  }`,
                  components: [],
                });
              }

              const FightEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(
                  `${user.name} VS ${
                    targetBrute?.user ? targetBrute.user.name : 'BOT'
                  }`,
                )
                .setURL(`${Env.SELF_URL}/${brute.name}/fight/${fight.id}`)
                .addFields({ name: '\u200b', value: '\u200b' })
                .addFields(
                  {
                    name: user.name,
                    value: `${brute.name} - lv${brute.level}`,
                    inline: true,
                  },
                  {
                    name: `${
                      targetBrute?.user ? targetBrute.user.name : 'BOT'
                    }`,
                    value: `${targetBrute?.name} - lv${targetBrute?.level}`,
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
              content: 'Confirmation not received within 1 minute, cancelling',
              components: [],
            });
          }
        }
      }
    }
  });

  await client.login(Env.DISCORD_BOT_SECRET);
};
