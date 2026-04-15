import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import pkg from 'pg';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { Client, GatewayIntentBits } from 'discord.js';
import riddles from './data/riddle.js';

const { Pool } = pkg;

const app = express();
app.use(express.json());

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  score INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  games_played INT DEFAULT 0,
  last_daily TIMESTAMP,
  last_weekly TIMESTAMP,
  last_monthly TIMESTAMP
);
`);

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.login(process.env.DISCORD_BOT_TOKEN);

// ================= GAME STATE =================
const activeGames = new Map();

// ================= ECONOMY SYSTEM =================
const GAME_REWARDS = {
  trivia: 2,
  riddle: 2,
  scramble: 3,
  math: 4,
  rps: 1,
};

// ================= TIME CONSTANTS =================
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// ================= CATEGORIES =================
const categories = {
  general: 9,
  sports: 21,
  books: 10,
  music: 12,
  history: 23,
  movies: 11,
};

// ================= TRIVIA API =================
async function generateTrivia(categoryId = 9) {
  const res = await axios.get(
    `https://opentdb.com/api.php?amount=1&type=multiple&category=${categoryId}&difficulty=easy`
  );

  const q = res.data.results[0];

  const decode = (str) =>
    str
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

  const options = [...q.incorrect_answers];
  const correctIndex = Math.floor(Math.random() * 4);
  options.splice(correctIndex, 0, q.correct_answer);

  return {
    question: decode(q.question),
    options: options.map(decode),
    answer: decode(q.correct_answer),
  };
}

// ================= RIDDLE FUNCTION =================
function generateRiddle() {
  return riddles[Math.floor(Math.random() * riddles.length)];
}

// ================= SCRAMBLE =================
async function generateScramble() {
  const res = await axios.get(
    'https://random-word-api.herokuapp.com/word?diff=1'
  );

  let word = res.data[0].toLowerCase();

  if (word.length < 4) return generateScramble();

  const scrambled = word
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');

  return { word, scrambled };
}

// ================= HELPERS =================
async function getUser(userId, username) {
  const res = await pool.query(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  if (res.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (id, username, score) VALUES ($1, $2, 0)`,
      [userId, username]
    );
    return { id: userId, username, score: 0 };
  }

  return res.rows[0];
}

// ================= ECONOMY =================
async function awardWin(userId, username, gameType) {
  await getUser(userId, username);

  const reward = GAME_REWARDS[gameType] || 1;

  await pool.query(
    `UPDATE users 
     SET score = score + $1,
         correct_answers = correct_answers + 1,
         games_played = games_played + 1
     WHERE id = $2`,
    [reward, userId]
  );

  return reward;
}

// ================= PEMDAS HANDLERS =================
function evaluatePEMDAS(numbers, operators) {
  // Convert into working arrays
  let nums = [...numbers];
  let ops = [...operators];

  // STEP 1: handle * and /
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      let result =
        ops[i] === '*'
          ? nums[i] * nums[i + 1]
          : nums[i] / nums[i + 1];

      nums.splice(i, 2, result);
      ops.splice(i, 1);
      i--;
    }
  }

  // STEP 2: handle + and -
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '+') result += nums[i + 1];
    if (ops[i] === '-') result -= nums[i + 1];
  }

  return result;
}

// ================= SERVER =================
app.post(
  '/interactions',
  verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY),
  async (req, res) => {
    const { type, data, channel_id } = req.body;

    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
      const userId = req.body.member?.user?.id;
      const username = req.body.member?.user?.username;

      // ================= TRIVIA =================
      if (data.name === 'trivia') {
        const category = data.options?.[0]?.value || 'general';
        const q = await generateTrivia(categories[category] || 9);

        activeGames.set(channel_id, {
          type: 'trivia',
          answer: q.answer.toLowerCase(),
          answeredUsers: new Set(),
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `🧠 Trivia (${category.toUpperCase()})\n\n` +
              `${q.question}\n\n` +
              `💬 Type your answer!`,
          },
        });
      }

      // ================= SCRAMBLE =================
      if (data.name === 'scramble') {
        const s = await generateScramble();

        activeGames.set(channel_id, {
          type: 'scramble',
          answer: s.word,
          answeredUsers: new Set(),
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `🧩 Word Scramble\n\n` +
              `Unscramble: **${s.scrambled}**\n\n` +
              `💬 Type your answer!`,
          },
        });
      }

      // ================= MATH =================
     if (data.name === 'math') {
        const ops = ['+', '-', '*', '/'];

        const numCount = Math.floor(Math.random() * 3) + 2; // 2–4 numbers

        let numbers = [];
        let operators = [];

        // generate small safe numbers
        for (let i = 0; i < numCount; i++) {
          numbers.push(Math.floor(Math.random() * 9) + 1);
        }

        for (let i = 0; i < numCount - 1; i++) {
          operators.push(ops[Math.floor(Math.random() * ops.length)]);
        }

        // BUILD expression string
        let expression = "";
        for (let i = 0; i < numbers.length; i++) {
          expression += numbers[i];
          if (i < operators.length) {
            const symbol =
              operators[i] === '*' ? '×' :
              operators[i] === '/' ? '÷' :
              operators[i];

            expression += ` ${symbol} `;
          }
        }

        // ENFORCE clean division (avoid decimals)
        let safeNumbers = [...numbers];

        for (let i = 0; i < operators.length; i++) {
          if (operators[i] === '/') {
            if (safeNumbers[i] % safeNumbers[i + 1] !== 0) {
              safeNumbers[i] = safeNumbers[i] * safeNumbers[i + 1];
            }
          }
        }

        const answer = evaluatePEMDAS(safeNumbers, operators);

        activeGames.set(channel_id, {
          type: 'math',
          answer: String(answer),
          numbers: numbers,
          operators: operators,
          answeredUsers: new Set(),
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `🧮 Math Race\n\n` +
              `What is ${expression}?\n\n` +
              `📌 Remember: PEMDAS applies!\n` +
              `💬 Type your answer!`,
          },
        });
      }

      // ================= RIDDLE =================
      if (data.name === 'riddle') {
        const r = generateRiddle();

        activeGames.set(channel_id, {
          type: 'riddle',
          answer: r.answer.toLowerCase().trim(),
          answeredUsers: new Set(),
        });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `🧠 Riddle\n\n`+
              `${r.question}\n\n`+
              `💬 Type your answer!`,
          },
        });
      }

      // ================= RPS =================
      if (data.name === 'rps') {
        const userChoice = data.options[0].value;
        const choices = ['rock', 'paper', 'scissors'];
        const bot = choices[Math.floor(Math.random() * 3)];

        const isWin =
          (userChoice === 'rock' && bot === 'scissors') ||
          (userChoice === 'paper' && bot === 'rock') ||
          (userChoice === 'scissors' && bot === 'paper');

        const isTie = userChoice === bot;

        let result;

        if (isTie) {
          result = "It's a tie!";
        } else if (isWin) {
          const reward = await awardWin(userId, username, 'rps');
          result = `You win!\n+${reward} point 🎉`;
        } else {
          result = 'You lose!';
        }

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              `✊ Rock Paper Scissors\n\nYou: ${userChoice}\nBot: ${bot}\n\n${result}`,
          },
        });
      }

      // ================= LEADERBOARD =================
      if (data.name === 'leaderboard') {
        const result = await pool.query(
          `SELECT username, score FROM users ORDER BY score DESC LIMIT 10`
        );

        const text =
          result.rows
            .map((u, i) => `${i + 1}. ${u.username} - ${u.score}`)
            .join('\n') || 'No players yet.';

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `🏆 Leaderboard:\n\n${text}` },
        });
      }

      // ================= DAILY =================
      if (data.name === 'daily') {
        const user = await getUser(userId, username);
        const last = user.last_daily ? new Date(user.last_daily).getTime() : 0;

        if (Date.now() - last < DAY) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Already claimed daily reward' },
          });
        }

        await pool.query(
          `UPDATE users SET score = score + 5, last_daily = NOW() WHERE id = $1`,
          [userId]
        );

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Daily +5 points 🎉' },
        });
      }

      // ================= WEEKLY =================
      if (data.name === 'weekly') {
        const user = await getUser(userId, username);
        const last = user.last_weekly ? new Date(user.last_weekly).getTime() : 0;

        if (Date.now() - last < WEEK) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Already claimed weekly reward' },
          });
        }

        await pool.query(
          `UPDATE users SET score = score + 25, last_weekly = NOW() WHERE id = $1`,
          [userId]
        );

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Weekly +25 points 🎉' },
        });
      }

      // ================= MONTHLY =================
      if (data.name === 'monthly') {
        const user = await getUser(userId, username);
        const last = user.last_monthly ? new Date(user.last_monthly).getTime() : 0;

        if (Date.now() - last < MONTH) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Already claimed monthly reward' },
          });
        }

        await pool.query(
          `UPDATE users SET score = score + 200, last_monthly = NOW() WHERE id = $1`,
          [userId]
        );

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Monthly +200 points 🎉' },
        });
      }
    }
  }
);

// ================= MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const game = activeGames.get(message.channel.id);
  if (!game) return;

  if (game.answeredUsers.has(message.author.id)) return;

  const userAnswer = message.content.toLowerCase().trim();
  const correct = game.answer.toLowerCase().trim();

  const isCorrect = userAnswer === correct;

  game.answeredUsers.add(message.author.id);

  if (isCorrect) {
    const reward = await awardWin(
      message.author.id,
      message.author.username,
      game.type
    );

    message.reply(`✅ Correct! \n\n +${reward} points 🎉`);
  } else {
    message.reply(`❌ Wrong!\n\n Answer: ${game.answer}`);
  }
});

// ================= START SERVER =================
app.listen(3000, () => {
  console.log('🚀 Server running on port 3000');
});