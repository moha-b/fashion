// Opt in to the local Codex parser: FASHION_CODEX_TESTS=1 node --test tests/codex-plugin.test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

function readPlugin(marketplacePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    let settled = false;
    const finish = (error, plugin) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error); else resolve(plugin);
    };
    const timer = setTimeout(() => finish(new Error('Codex plugin/read timed out')), 30000);
    const send = (message) => child.stdin.write(JSON.stringify(message) + '\n');
    child.on('error', (error) => finish(error));
    child.on('exit', (code) => finish(new Error(`Codex exited before plugin/read: ${code}`)));
    child.stdin.on('error', (error) => finish(error));
    child.stderr.resume();
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (message.error) { finish(new Error(JSON.stringify(message.error))); return; }
          if (message.id === 1) {
            send({ method: 'initialized' });
            send({ id: 2, method: 'plugin/read', params: { pluginName: 'fashion', marketplacePath } });
          }
          if (message.id === 2) finish(null, message.result.plugin);
        } catch (error) { finish(error); return; }
      }
    });
    send({ id: 1, method: 'initialize', params: {
      clientInfo: { name: 'fashion-plugin-test', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    } });
  });
}

test('Codex discovers its entry skill and MCP servers without Claude hooks', {
  skip: process.env.FASHION_CODEX_TESTS !== '1', timeout: 35000,
}, async () => {
  const marketplace = fileURLToPath(new URL('../.agents/plugins/marketplace.json', import.meta.url));
  const plugin = await readPlugin(marketplace);
  assert.equal(plugin.summary.id, 'fashion@fashion');
  assert.equal(plugin.summary.localVersion, '0.5.0');
  assert.equal(plugin.summary.availability, 'AVAILABLE');
  assert.deepEqual(plugin.skills.map((skill) => skill.name), ['fashion:fashion']);
  assert.ok(plugin.skills[0].path.endsWith('/codex/skills/fashion/SKILL.md'));
  assert.deepEqual(plugin.mcpServers.sort(), ['awwwards', 'dembrandt', 'inspo', 'responsively']);
  assert.deepEqual(plugin.hooks, []);
});
