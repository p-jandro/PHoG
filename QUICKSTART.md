# PHoG Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js v20+ installed
- Three terminal windows ready

## Step 1: Install Dependencies

```powershell
# Server
cd packages\server
npm install

# Client
cd ..\client
npm install

# Host
cd ..\host
npm install

cd ..\..
```

## Step 2: Configure Environment

Create `.env.local` in the project root:

```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
HOST_URL=http://localhost:5174
HOST_PASSWORD=admin123
```

## Step 3: Start All Services

**Terminal 1 - Server:**
```powershell
cd packages\server
npm run dev
```

**Terminal 2 - Player App:**
```powershell
cd packages\client
npm run dev
```

**Terminal 3 - Host Control:**
```powershell
cd packages\host
npm run dev
```

## Step 4: Open Apps

- **Host Control Panel**: http://localhost:5174
  - Login with password: `admin123`
  
- **Player App**: http://localhost:5173
  - Open in multiple browser tabs/devices to simulate multiple players
  - Enter different names for each player

## Step 5: Play!

1. **On Host Panel:**
   - Wait for players to join
   - Start a single game or launch a championship sequence

2. **On Player App:**
   - Follow the on-screen instructions
   - Vote, answer, or submit words as prompted

## Testing with Multiple Players

### Option 1: Multiple Browser Tabs
- Open http://localhost:5173 in multiple tabs
- Join with different names in each tab

### Option 2: Multiple Devices on Same Network
- Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- On other devices, go to: `http://YOUR_LOCAL_IP:5173`

### Option 3: Incognito/Private Windows
- Use incognito/private browsing mode to simulate different users

## Troubleshooting

**Server won't start:**
- Check if port 3000 is already in use
- Try changing PORT in `.env.local`

**Client/Host can't connect:**
- Verify server is running
- Check the console for connection errors
- Ensure `.env.local` URLs are correct

**Players can't join:**
- Make sure server shows "Connected" status
- Check network firewall settings
- Try refreshing the page

## Game Controls (Host)

- **Start Quiz**: Begin the quiz game
- **Start True/False**: Begin true/false game
- **Start Pointless**: Begin the low-score answer round
- **Championship Mode**: Run the full multi-game sequence
- **Return to Lobby**: Go back to waiting room
- **Reset Game**: Reset all scores and return to lobby

## Default Settings

- **Max Players**: 30
- **Quiz Questions**: 15 per game
- **True/False Statements**: 30 per game
- **Pointless Rounds**: 5 per game
- **Host Password**: admin123 (change in `.env.local`)

## Next Steps

- Add or edit quiz rounds in `packages/server/src/data/quizRounds.json`
- Add more statements to `packages/server/src/data/statements.json`
- Add or edit Pointless categories in `packages/server/src/data/pointless.json`
- Customize colors in `tailwind.config.js`
- Deploy to production (see README.md)

## Need Help?

Check the full README.md for:
- Architecture details
- Deployment instructions
- API documentation
- Advanced configuration

Enjoy your game! 🎮
