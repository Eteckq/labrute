import { ExpectedError, ARENA_OPPONENTS_COUNT } from '@labrute/core';
import moment from 'moment';
import {
  PrismaClient, User,
} from '@labrute/prisma';
import translate from '../utils/translate.js';
import getOpponents from '../utils/brute/getOpponents.js';

export async function fcGetOpponnents(prisma: PrismaClient, user: User, name: string) {
  // Get brute
  const brute = await prisma.brute.findFirst({
    where: {
      name,
      deletedAt: null,
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      level: true,
      opponentsGeneratedAt: true,
      opponents: {
        select: {
          id: true,
          name: true,
          level: true,
          gender: true,
          hp: true,
          strengthValue: true,
          agilityValue: true,
          speedValue: true,
          deletedAt: true,
          body: true,
          colors: true,
          user: true,
        },
      },
    },
  });

  if (!brute) {
    throw new ExpectedError(translate('bruteNotFound', user));
  }

  // Handle deleted opponents
  const opponents = brute.opponents.filter((o) => o.deletedAt === null);

  // If never generated today or not enough opponents, reset opponents
  if (
    !brute.opponentsGeneratedAt
    || moment
      .utc(brute.opponentsGeneratedAt)
      .isBefore(moment.utc().startOf('day'))
    || opponents.length < ARENA_OPPONENTS_COUNT
  ) {
    // Get opponents
    const opponents2 = await getOpponents(prisma, brute);

    // Save opponents
    await prisma.brute.update({
      where: {
        id: brute.id,
      },
      data: {
        opponents: {
          set: opponents2.map((o) => ({
            id: o.id,
          })),
        },
        // Update opponentsGeneratedAt
        opponentsGeneratedAt: new Date(),
      },
      select: { id: true },
    });
    return opponents2;
  }

  return opponents;
}
