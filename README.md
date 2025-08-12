# CX Hunt Overlay (Temporary)

Transparent Tailwind, CX in the Chat Dude
Just use https://cxhunt-production.up.railway.app/overlay/kickusername and slap it in OBS or whatever you prefer
## Endpoints
- `GET /overlay/:kick` → Overlay HTML (transparent, glass UI)
- `GET /overlay/:kick?format=json` → JSON passthrough from upstream

## Env
```
PORT=3000
UPSTREAM_TEMPLATE=https://api.iceposeidon.com/overlay/{kick}
CACHE_MS=2000
```

## Run locally
```
npm i
npm start
```
Open http://localhost:3000/overlay/yourkickname

## OBS example

`https://<your-railway-app>.up.railway.app/overlay/kangjoel?w=730&font=pixel&color=4fff00&live=1`



