# WorldBuilderX

## Development Policy

Use npm as the repository package manager.

The project is prepared as a root Node/npm workspace with `package.json` and
`package-lock.json`. Future agents should run Node-based checks through npm once
npm is available in the active shell. In Codex desktop sessions, Node is
available through the bundled runtime path reported by the workspace dependency
loader when `node` is not on `PATH`.

Clean installs must use:

```sh
npm ci
```

The security gate is:

```sh
npm audit --audit-level=high
```
