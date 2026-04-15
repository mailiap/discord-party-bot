# Discord Game Hub Bot

A Discord bot that turns your server into a mini game hub 
Play trivia, word scramble, math games, riddles, and more directly in chat.

---

## Features

### Mini Games
- 🧠 Trivia (multiple categories)
- 🧩 Word Scramble
- 🧮 Math Race
- 🧠 Riddles
- ✊ Rock Paper Scissors

### Systems
- Leaderboard
- Daily / Weekly / Monthly rewards
- Persistent scoring (PostgreSQL)
- Multi-game support

---

## 🤖 Add This Bot to Your Server

### 👉 Invite Link

Click below to add the bot:

```
https://discord.com/oauth2/authorize?client_id=1491559333035511908
```

---

### Steps

1. Click the invite link above  
2. Select your Discord server  
3. Click **Continue**  
4. Click **Authorize**  
5. Done

---

### Try These Commands

Once added, use:

- `/trivia`
- `/scramble`
- `/math`
- `/riddle`
- `/rps`
- `/leaderboard`
- `/daily`
- `/weekly`
- `/monthly`

---

## Local Setup (Optional)

If you want to run the bot yourself:

### 1. Clone the repo
```bash
git clone https://github.com/mailiap/discord-party-bot.git
cd discord-party-bot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_PUBLIC_KEY=your_public_key
APP_ID=your_app_id
DATABASE_URL=your_database_url
```

### 4. Register commands
```bash
npm run register
```

### 5. Start the bot
```bash
npm run start
```

---

## How It Works

- Discord sends commands to your server
- Express handles requests
- Game logic runs mini-games
- APIs provide dynamic content
- PostgreSQL stores user data

---

## Tech Stack

- Node.js
- Express
- Discord API
- PostgreSQL
- Axios

---

## Future Improvements

- Player profiles
- XP + leveling system
- Multiplayer battles
- Game lobbies
- Shop / power-ups

---

## License

This project is for educational use.
