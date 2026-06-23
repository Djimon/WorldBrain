# Contributing

## Development Policy

Use npm as the repository package manager.

The project is prepared as a root Node/npm workspace with `package.json` and
`package-lock.json`. The project targets Node.js `24.17.0` LTS and npm
`11.13.0`; `.node-version` and `package.json` are the source of truth.

Install Node.js `24.17.0` LTS with a normal developer toolchain such as the
official Node.js installer, winget, fnm, nvm-windows, Volta, or asdf. Then verify
the active shell:

```sh
npm run check:toolchain
```

Do not install Node.js or npm into repository folders. npm should come from the
developer toolchain, and project dependencies should come from `npm ci`.

Clean installs must use:

```sh
npm ci
```

The security gate is:

```sh
npm audit --audit-level=high
```
