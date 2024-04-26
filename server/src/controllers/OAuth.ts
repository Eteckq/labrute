import { PrismaClient } from '@labrute/prisma';
import { Request, Response } from 'express';
import { ExpectedError } from '@labrute/core';
import {
  OAuth2Routes, RESTPostOAuth2AccessTokenResult, RouteBases, RESTGetAPIUserResult,
} from 'discord.js';
import fetch from 'node-fetch';
import Env from '../utils/Env.js';
import sendError from '../utils/sendError.js';

async function getToken(code: string) {
  const data_1 = new URLSearchParams();
  data_1.append('client_id', Env.DISCORD_CLIENT_ID);
  data_1.append('client_secret', Env.DISCORD_CLIENT_SECRET);
  data_1.append('grant_type', 'authorization_code');
  data_1.append('redirect_uri', Env.SELF_URL);
  data_1.append('scope', 'identify');
  data_1.append('code', code);
  return fetch(OAuth2Routes.tokenURL, { method: 'POST', body: data_1 }).then((res) => res.json() as Promise<RESTPostOAuth2AccessTokenResult>);
}

const OAuth = {
  redirect: (req: Request, res: Response) => {
    try {
      res.send({
        url: `${OAuth2Routes.authorizationURL}?client_id=1232306145582911528&response_type=code&redirect_uri=${Env.SELF_URL}&scope=identify`,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  token: (prisma: PrismaClient) => async (req: Request, res: Response) => {
    try {
      if (!req.query.code || typeof req.query.code !== 'string') {
        throw new ExpectedError('Invalid code');
      }
      const resToken = await getToken(req.query.code);
      const discordUser: RESTGetAPIUserResult = await fetch(`${RouteBases.api}/users/@me`, { headers: { authorization: `Bearer ${resToken.access_token}` } }).then((r) => r.json() as Promise<RESTGetAPIUserResult>);

      const existingUser = await prisma.user.findFirst({
        where: { id: discordUser.id },
      });

      // If user does not exist, create it
      if (!existingUser) {
        const usersCount = await prisma.user.count();
        await prisma.user.create({
          data: {
            id: discordUser.id,
            connexionToken: resToken.access_token,
            name: discordUser.username,
            admin: usersCount === 0,
          },
          select: { id: true },
        });
      } else {
        // If user exists, update it
        await prisma.user.update({
          where: { id: discordUser.id },
          data: {
            connexionToken: resToken.access_token,
          },
          select: { id: true },
        });
      }

      // Fetch user data
      const user = await prisma.user.findFirst({
        where: { id: discordUser.id, connexionToken: resToken.access_token },
        include: {
          brutes: {
            where: { deletedAt: null },
            include: { body: true, colors: true },
          },
        },
      });

      res.send(user);
    } catch (error) {
      sendError(res, error);
    }
  },
};

export default OAuth;
