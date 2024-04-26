import { ExpectedError, GLOBAL_TOURNAMENT_START_HOUR } from '@labrute/core';
import { PrismaClient, TournamentType } from '@labrute/prisma';
import { Request, Response } from 'express';
import moment from 'moment';
import auth from '../utils/auth.js';
import sendError from '../utils/sendError.js';
import translate from '../utils/translate.js';
import { doFight } from '../services/fights.js';

const Fights = {
  get: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      if (!req.params.name || !req.params.id) {
        throw new ExpectedError('Missing parameters');
      }

      if (Number.isNaN(+req.params.id)) {
        throw new ExpectedError('Invalid parameters');
      }

      // Get fight
      const fight = await prisma.fight.findFirst({
        where: {
          id: +req.params.id,
          OR: [
            { brute1: { name: req.params.name } },
            { brute2: { name: req.params.name } },
          ],
        },
      });

      if (!fight) {
        throw new ExpectedError('Fight not found');
      }

      // Limit viewing if the fight is from a global tournament round not yet reached
      const tournamentStep = await prisma.tournamentStep.findFirst({
        where: {
          tournament: {
            type: TournamentType.GLOBAL,
            date: { gte: new Date() },
          },
          fightId: fight.id,
        },
      });

      const now = moment.utc();
      const hour = now.hour();

      if (tournamentStep && tournamentStep.step > hour - GLOBAL_TOURNAMENT_START_HOUR + 1) {
        throw new ExpectedError('Fight unavailable for now');
      } else {
        res.send(fight);
      }
    } catch (error) {
      sendError(res, error);
    }
  },
  create: (prisma: PrismaClient) => async (
    req: Request<never, unknown, { brute1: string, brute2: string }>,
    res: Response<FightCreateResponse>,
  ) => {
    try {
      const user = await auth(prisma, req);
      if (!req.body.brute1 || !req.body.brute2) {
        throw new ExpectedError(translate('missingParameters', user));
      }

      const fight = await doFight(prisma, user, req.body.brute1, req.body.brute2);

      res.send({
        id: fight.id,
        xpWon: arenaFight ? xpGained : 0,
        fightsLeft: getFightsLeft(brute1) - 1,
        victories: arenaFight ? generatedFight.winner === brute1.name ? 1 : 0 : 0,
      });

    } catch (error) {
      sendError(res, error);
    }
  },
};

export default Fights;
