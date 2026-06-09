# Running Simulator Web

Three.js running simulator packaged with Vite and ready for GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The site is built into `dist/`.

## GitHub Pages

This repository is configured for deployment at `/running_simulator_web/`.

- Push to `main`.
- In the GitHub repository settings, set Pages to use `GitHub Actions`.
- The workflow in `.github/workflows/deploy.yml` builds the app and deploys `dist/`.

## Assets

- `orlando_stadium_4k.hdr` is bundled automatically during the Vite build.
- Put `trackfield_22fbx.glb` in the repository root, next to `package.json`. Vite now bundles it automatically during `npm run build`, so it will be deployed with GitHub Pages.
- If `trackfield_22fbx.glb` is absent, the app shows a fallback running track preview instead of failing.