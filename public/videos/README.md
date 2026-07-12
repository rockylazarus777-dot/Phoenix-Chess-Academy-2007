# Hero video

Place the 10-second cinematic hero video here as:

```
public/videos/hero.mp4
```

Recommended encode for web playback (H.264, faststart, no audio track needed since the `<video>` is muted):

```
ffmpeg -i source.mov -an -vcodec libx264 -crf 23 -preset slow -movflags +faststart -vf "scale=1920:-2" hero.mp4
```

Referenced by `src/components/home/HeroVideo.tsx` via `src/components/home/Hero.tsx`.
