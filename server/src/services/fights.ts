import { ExpectedError, LOSE_XP, WIN_XP } from '@labrute/core';
import {
  PrismaClient, Prisma, User,
} from '@labrute/prisma';
import translate from '../utils/translate.js';
import { LOGGER, DISCORD } from '../context.js';
import generateFight from '../utils/fight/generateFight.js';
import getOpponents from '../utils/brute/getOpponents.js';

export async function doFight(
  prisma: PrismaClient,
  user: User,
  brute1_name: string,
  brute2_name: string,
  forceTraining: boolean = false,
) {
  // Get brutes
  const brute1 = await prisma.brute.findFirst({
    where: {
      name: brute1_name,
      deletedAt: null,
      userId: user.id,
    },
    include: {
      body: true,
      colors: true,
      opponents: {
        select: { name: true },
      },
    },
  });
  if (!brute1) {
    throw new ExpectedError(translate('bruteNotFound', user));
  }

  const brute2 = await prisma.brute.findFirst({
    where: {
      name: brute2_name,
      deletedAt: null,
    },
    include: {
      body: true,
      colors: true,
    },
  });
  if (!brute2) {
    throw new ExpectedError(translate('bruteNotFound', user));
  }
  // Check if this is an arena fight
  let arenaFight = brute1.opponents.some(
    (opponent) => opponent.name === brute2.name,
  ) && brute1.fightsLeft > 0;
  if (forceTraining) {
    arenaFight = false;
  }

  // Update brute last fight and fights left if arena fight
  if (arenaFight) {
    await prisma.brute.update({
      where: { id: brute1.id },
      data: {
        lastFight: new Date(),
        fightsLeft: brute1.fightsLeft - 1,
      },
      select: { id: true },
    });
  }

  // Generate fight (retry if failed)
  let generatedFight: Prisma.FightCreateInput | null = null;
  let expectedError: ExpectedError | null = null;
  let retry = 0;

  while (!generatedFight && !expectedError && retry < 10) {
    try {
      retry += 1;

      // eslint-disable-next-line no-await-in-loop
      generatedFight = await generateFight(
        prisma,
        brute1,
        brute2,
        true,
        arenaFight,
        false,
      );
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error instanceof ExpectedError) {
        expectedError = error;
      } else {
        LOGGER.log(
          `Error while generating fight between ${brute1.name} and ${brute2.name}, retrying...`,
        );
        DISCORD.sendError(error);
      }
    }
  }

  if (expectedError || !generatedFight) {
    throw expectedError;
  }

  // Save important fight data
  const fight = await prisma.fight.create({
    data: generatedFight,
    select: { id: true, winner: true, loser: true },
  });

  const levelDifference = brute1.level - brute2.level;

  let xpGained = 0;

  if (arenaFight) {
    if (generatedFight.winner === brute1.name) {
      xpGained = Math.max(WIN_XP - (Math.floor(levelDifference / 2)), LOSE_XP);
    } else {
      xpGained = LOSE_XP;
    }

    if (!brute2.userId) {
      xpGained -= 1;
    }

    const maxLevelBrute = await prisma.brute.findFirst(
      { where: { user: { isNot: null }, deletedAt: null }, orderBy: { level: 'desc' } },
    );

    if (maxLevelBrute) {
      xpGained += Math.max(Math.floor((maxLevelBrute.level - brute1.level) / 5), 0);
    }
  }

  // Update brute XP and victories if arena fight
  if (arenaFight) {
    await prisma.brute.update({
      where: { id: brute1.id },
      data: {
        xp: { increment: xpGained },
        victories: { increment: generatedFight.winner === brute1.name ? 1 : 0 },
      },
      select: { id: true },
    });
  }

  // Add fighter log
  await prisma.log.create({
    data: {
      currentBrute: { connect: { id: brute1.id } },
      type: generatedFight.winner === brute1.name ? 'win' : 'lose',
      brute: brute2.name,
      fight: { connect: { id: fight.id } },
      xp: xpGained,
    },
    select: { id: true },
  });

  // Add opponent log
  await prisma.log.create({
    data: {
      currentBrute: { connect: { id: brute2.id } },
      type: generatedFight.winner === brute2.name ? 'survive' : 'lose',
      brute: brute1.name,
      fight: { connect: { id: fight.id } },
    },
    select: { id: true },
  });

  // Update brute opponents if the opponent was in the arena
  if (brute1.opponents.some((o) => o.name === brute2.name)) {
    // Get new opponents
    const newOpponents = await getOpponents(prisma, brute1);

    // Save opponents
    await prisma.brute.update({
      where: {
        id: brute1.id,
      },
      data: {
        opponents: {
          set: newOpponents.map((o) => ({
            id: o.id,
          })),
        },
        // Update opponentsGeneratedAt
        opponentsGeneratedAt: new Date(),
      },
      select: { id: true },
    });
  }

  return fight;
}
