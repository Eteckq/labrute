import { ExpectedError, canLevelUp, getLevelUpChoices } from '@labrute/core';
import {
  Brute, DestinyChoice, DestinyChoiceSide, User,
} from '@labrute/prisma';
import { PrismaClient } from '@prisma/client';
import translate from '../utils/translate.js';

export async function levelUp(prisma: PrismaClient, user: User, brute: Brute) {
  if (!canLevelUp(brute)) {
    throw new ExpectedError(translate('bruteCannotLevelUp', user));
  }

  const firstChoicePath = [...brute.destinyPath, DestinyChoiceSide.LEFT];
  const secondChoicePath = [...brute.destinyPath, DestinyChoiceSide.RIGHT];

  // Get destiny choices
  let firstDestinyChoice: DestinyChoice = await prisma.destinyChoice.findFirst({
    where: {
      bruteId: brute.id,
      path: { equals: firstChoicePath },
    },
  });
  let secondDestinyChoice: DestinyChoice = await prisma.destinyChoice.findFirst({
    where: {
      bruteId: brute.id,
      path: { equals: secondChoicePath },
    },
  });

  if (!firstDestinyChoice || !secondDestinyChoice) {
    const newChoices = getLevelUpChoices(brute);

    // Create destiny choices
    const newFirstDestinyChoice = await prisma.destinyChoice.create({
      data: {
        ...newChoices[0],
        path: firstChoicePath,
        brute: { connect: { id: brute.id } },
      },
    });
    firstDestinyChoice = newFirstDestinyChoice;

    const newSecondDestinyChoice = await prisma.destinyChoice.create({
      data: {
        ...newChoices[1],
        path: secondChoicePath,
        brute: { connect: { id: brute.id } },
      },
    });
    secondDestinyChoice = newSecondDestinyChoice;
  }

  return [firstDestinyChoice, secondDestinyChoice];
}