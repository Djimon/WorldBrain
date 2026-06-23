import { execFileSync } from 'node:child_process';

function run(command, args, label, installHint) {
  try {
    const output = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    console.log(`${label}: ${output}`);
  } catch {
    throw new Error(`${label} missing. Install or repair prerequisite: ${installHint}`);
  }
}

function runNpm() {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], 'npm', 'install Node.js LTS with npm');
    return;
  }

  run('npm', ['--version'], 'npm', 'install Node.js LTS with npm');
}

run('node', ['--version'], 'Node.js', 'install Node.js 24.17.0 LTS');
runNpm();
run('rustc', ['--version'], 'Rust compiler', 'install Rust with rustup');
run('cargo', ['--version'], 'Cargo', 'install Rust with rustup');
run('cargo', ['tauri', '--version'], 'Tauri CLI', 'install Tauri CLI for the selected Tauri v2 path');

console.log('Node, npm, Rust, Cargo, and Tauri CLI prerequisites are available.');
