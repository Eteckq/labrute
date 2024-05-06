import { getMaxFightsPerDay, randomBetween } from '@labrute/core';
import { PrismaClient } from '@labrute/prisma';

const giveFightJob = (prisma: PrismaClient) => async () => {
  const brutes = await prisma.brute.findMany({
    where: {
      deletedAt: null,
    },
  });

  for (const brute of brutes) {
    if (brute.fightsLeft < getMaxFightsPerDay(brute)) {
      prisma.brute.update({
        where: {
          id: brute.id,
        },
        data: {
          fightsLeft: { increment: 1 + (brute.skills.includes('regeneration') && randomBetween(0, 100) > 75 ? 1 : 0) },
        },
      }).catch(console.error);
    }
  }
};

export default giveFightJob;