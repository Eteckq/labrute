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
} from 'discord.js';
import { PrismaClient } from '@labrute/prisma';
import { canLevelUp, getLevelUpChoices } from '@labrute/core';
import Env from '../utils/Env.js';
import { doFight } from '../services/fights.js';
import { fcGetOpponnents } from '../services/fcGetOpponents.js';

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
        if (brute.fightsLeft === 0) {
          await interaction.editReply({
            content: 'Tu as terminé tes combats. Reviens dans quelques heures!',
            components: [],
          });
        } else {
          const opponents = await fcGetOpponnents(prisma, user, brute.name);

          if (!opponents) {
            await interaction.reply({
              content: 'Error while finding opponents',
              ephemeral: true,
            });
          } else {
            const components = [];
            if (opponents.length === 0) {
              await interaction.reply({
                content: 'Aucun adversaires disponibles',
                ephemeral: true,
              });
            } else {
              for (const opponent of opponents) {
                const pseudo = (opponent as any).user ? (opponent as any).user.name : 'bot';
                components.push(
                  new ButtonBuilder()
                    .setCustomId(opponent.name)
                    .setLabel(`${opponent.name} (${pseudo}) - lv${opponent.level}`)
                    .setStyle(
                      (opponent as any).user ? ButtonStyle.Primary : ButtonStyle.Secondary,
                    ),
                );
              }

              const row: any = new ActionRowBuilder().addComponents(...components);

              const response = await interaction.reply({
                content: 'Choisis ton adversaire',
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
                      // const choices = getLevelUpChoices(updatedBrute);
                      // console.log(choices);

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
    }
  });

  await client.login(Env.DISCORD_BOT_SECRET);
};
