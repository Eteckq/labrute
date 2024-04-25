import { REST, Routes } from 'discord.js';
import Env from '../utils/Env.js';

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
];

export default async () => {
  const rest = new REST({ version: '10' }).setToken(Env.DISCORD_BOT_SECRET);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(Env.DISCORD_CLIENT_ID), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};