# CX Hunt Overlay (Temporary)

Transparent Tailwind, CX in the Chat Dude.

Just use https://cxhunt-production.up.railway.app/overlay/kickusername and slap it in OBS or whatever you prefer
Works for everyone except Tazo, PATRICKBOO
## Endpoints
- `GET /overlay/:kick` → Overlay HTML (transparent, glass UI)
- `GET /overlay/:kick?format=json` → JSON passthrough from upstream

Example in the bottom right:
<img width="1920" height="1080" alt="Example Image" src="https://github.com/user-attachments/assets/1fa5913c-7245-49b5-bcab-d73881fb1378" />

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

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## OBS example

`https://<your-railway-app>.up.railway.app/overlay/kangjoel?w=730&font=pixel&color=4fff00&live=1`

More at https://creatolay.com :)