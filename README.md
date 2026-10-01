# Luau Playground

A static Luau playground that runs scripts in the browser with the Luau WebAssembly runtime. Code is kept in the browser and never sent to a server.

## Run locally

```sh
npm install
npm run dev
```

## Deploy

For Cloudflare Pages, connect this repository and set the build command to `npm run build` and the output directory to `dist`.

For GitHub Pages, build the project with `npm run build` and publish the generated `dist` directory. The relative asset base is configured for repository subpaths.