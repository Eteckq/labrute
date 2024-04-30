import { getMaxFightsPerDay } from '@labrute/core';
import { PrismaClient } from '@labrute/prisma';

const giveFightJob = (prisma: PrismaClient) => async () => {
  console.log('Give fights');

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
          fightsLeft: { increment: 1 },
        },
      }).catch(console.error);
    }
  }
};

export default giveFightJob;