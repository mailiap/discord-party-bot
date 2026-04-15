import 'dotenv/config';
import axios from 'axios';

const commands = [
  {
    name: 'trivia',
    description: 'Get a trivia question',
    options: [
      {
        name: 'category',
        type: 3,
        description: 'Category',
        required: false,
        choices: [
          { name: 'general', value: 'general' },
          { name: 'sports', value: 'sports' },
          { name: 'books', value: 'books' },
          { name: 'music', value: 'music' },
          { name: 'history', value: 'history' },
          { name: 'movies', value: 'movies' },
        ],
      },
    ],
  },
  { name: 'scramble', description: 'Unscramble a word' },
  { name: 'math', description: 'Answer a math question in under 15 seconds' },
  { name: 'riddle', description: 'Solve a riddle' },
  {
    name: 'rps',
    description: 'Start a rock paper scissors Game',
    options: [
      {
        name: 'choice',
        description: 'Pick rock, paper, or scissors',
        type: 3,
        required: true,
        choices: [
          { name: 'rock', value: 'rock' },
          { name: 'paper', value: 'paper' },
          { name: 'scissors', value: 'scissors' },
        ],
      },
    ],
  },
  { name: 'leaderboard', description: 'Show leaderboard' },
  { name: 'daily', description: 'Claim daily rewards' },
  { name: 'weekly', description: 'Claim weekly rewards' },
  { name: 'monthly', description: 'Claim monthly rewards' },
];

async function register() {
  try {
    await axios.put(
      `https://discord.com/api/v10/applications/${process.env.APP_ID}/commands`,
      commands,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Commands registered!');
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

register();