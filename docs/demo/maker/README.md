# How the explainer video was made

`guardrail-explainer.mp4` (60 s, 1920×1080, H.264 + AAC) is drawn frame by frame on a canvas (`explainer.html`) and
encoded inside headless Google Chrome with WebCodecs; `mp4.js` writes the MP4 file and the background music is composed
with WebAudio (original, no licence needed). No video editor or ffmpeg. The toolkit (`cdp.mjs`, `make.mjs`, `mp4.js`)
is copied from HomeHaat's video maker, so the two explainers (and Oppora's) share the same 8-scene structure and timing.

```powershell
node docs/demo/maker/make.mjs preview 3 10 27   # stills at those seconds -> docs/demo/preview/ (not committed)
node docs/demo/maker/make.mjs video             # -> docs/demo/guardrail-explainer.mp4 (+ poster)
```

Needs Google Chrome installed at the default path (see `cdp.mjs`).
