# Countdown Theme Music

## Setup

To enable the countdown theme music during gameplay:

1. Place your audio file in this directory
2. Name it `countdown-theme.mp3`
3. Restart the client development server

## Audio File Requirements

- **Format**: MP3 (recommended) or other web-compatible formats (WAV, OGG)
- **Duration**: 30-60 seconds (it will loop automatically)
- **Volume**: Already normalized to 40% in the app, so use a file with good levels
- **Style**: Upbeat, energetic music suitable for a word game countdown

## Alternative Filenames

If you want to use a different filename or format, edit:
`packages/client/src/screens/Countdown.tsx` line 32

Change:
```typescript
const audio = useAudio('/audio/countdown-theme.mp3', {
```

To your preferred file:
```typescript
const audio = useAudio('/audio/your-file-name.mp3', {
```

## Suggested Music Sources

- [Free Music Archive](https://freemusicarchive.org/)
- [YouTube Audio Library](https://www.youtube.com/audiolibrary/music)
- [Incompetech](https://incompetech.com/)
- [Bensound](https://www.bensound.com/)

## Features

- ✅ Automatically plays when countdown round starts
- ✅ Loops during the 30-second countdown
- ✅ Fades out smoothly when time expires
- ✅ Volume control button in-game (🔊/🔇)
- ✅ Set to 40% volume by default

## Troubleshooting

If the music doesn't play:
1. Check browser console for audio errors
2. Ensure the file path is correct
3. Try a different audio format
4. Check browser autoplay policies (some browsers block autoplay with sound)

