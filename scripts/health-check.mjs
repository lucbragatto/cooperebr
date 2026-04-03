#!/usr/bin/env node
/**
 * health-check.mjs — CoopereAI Health Check
 * Checks: pm2 services, backend /health, recent error log.
 * Outputs JSON + human summary.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ERROR_LOG = resolve(__dirname, '..', 'logs', 'nest-error.log');
const HEALTH_URL = 'http://localhost:3000/health';

function checkPm2() {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 10000 });
    const processes = JSON.parse(output);
    return {
      status: processes.every(p => p.pm2_env?.status === 'online') ? 'ok' : 'degraded',
      services: processes.map(p => ({
        name: p.name,
        status: p.pm2_env?.status ?? 'unknown',
        pid: p.pid,
        uptime: p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) : null,
        restarts: p.pm2_env?.restart_time ?? 0,
        memory: p.monit?.memory ? Math.round(p.monit.memory / 1024 / 1024) : null,
        cpu: p.monit?.cpu ?? null,
      })),
    };
  } catch (err) {
    return { status: 'error', error: err.message.split('\n')[0], services: [] };
  }
}

async function checkHealthEndpoint() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    const body = await res.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    return {
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      responseTime: null,
      data,
    };
  } catch (err) {
    return {
      status: 'down',
      error: err.cause?.code || err.message,
    };
  }
}

function checkErrorLog() {
  if (!existsSync(ERROR_LOG)) {
    return { status: 'no_file', message: 'nest-error.log not found' };
  }

  const stat = statSync(ERROR_LOG);
  const content = readFileSync(ERROR_LOG, 'utf-8');
  const lines = content.split('\n');

  // Count recent errors (last 1h)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let recentErrors = 0;
  let p2024Count = 0;
  let lastErrorTime = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    const tsMatch = lines[i].match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):/);
    if (!tsMatch) continue;

    const ts = new Date(tsMatch[1].replace(' ', 'T'));
    if (ts < oneHourAgo) break;

    if (!lastErrorTime) lastErrorTime = tsMatch[1];
    recentErrors++;

    if (/P2024/i.test(lines[i])) p2024Count++;
  }

  const hasCritical = p2024Count > 0;

  return {
    status: hasCritical ? 'critical' : recentErrors > 50 ? 'warning' : 'ok',
    fileSizeKb: Math.round(stat.size / 1024),
    totalLines: lines.length,
    errorsLastHour: recentErrors,
    p2024LastHour: p2024Count,
    lastErrorTime,
  };
}

async function run() {
  const startTime = Date.now();

  const [pm2, health] = await Promise.all([
    Promise.resolve(checkPm2()),
    checkHealthEndpoint(),
  ]);

  const errorLog = checkErrorLog();

  const overallStatus =
    pm2.status === 'error' || health.status === 'down' || errorLog.status === 'critical'
      ? 'critical'
      : pm2.status === 'degraded' || health.status === 'error' || errorLog.status === 'warning'
        ? 'warning'
        : 'ok';

  const result = {
    status: overallStatus,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    checks: { pm2, health, errorLog },
  };

  console.log(JSON.stringify(result, null, 2));

  // Human summary
  console.log('\n' + '='.repeat(60));
  console.log(`  CoopereAI Health Check — ${result.checkedAt}`);
  console.log('='.repeat(60));
  console.log(`  Overall: ${overallStatus.toUpperCase()} (${result.durationMs}ms)`);

  // PM2
  const pm2Icon = pm2.status === 'ok' ? '[OK]' : pm2.status === 'degraded' ? '[!!]' : '[X]';
  console.log(`\n  ${pm2Icon} PM2 Services: ${pm2.status}`);
  for (const s of pm2.services) {
    const sIcon = s.status === 'online' ? '+' : '-';
    const mem = s.memory ? `${s.memory}MB` : '?';
    const up = s.uptime ? `${Math.round(s.uptime / 60)}min` : '?';
    console.log(`      ${sIcon} ${s.name}: ${s.status} | mem: ${mem} | up: ${up} | restarts: ${s.restarts}`);
  }
  if (pm2.error) console.log(`      Error: ${pm2.error}`);

  // Health endpoint
  const hIcon = health.status === 'ok' ? '[OK]' : '[X]';
  console.log(`\n  ${hIcon} Backend /health: ${health.status}${health.httpStatus ? ` (HTTP ${health.httpStatus})` : ''}`);
  if (health.error) console.log(`      Error: ${health.error}`);

  // Error log
  const eIcon = errorLog.status === 'ok' ? '[OK]' : errorLog.status === 'critical' ? '[!!!]' : '[!!]';
  console.log(`\n  ${eIcon} Error Log: ${errorLog.status}`);
  if (errorLog.errorsLastHour !== undefined) {
    console.log(`      Errors last hour: ${errorLog.errorsLastHour}`);
    if (errorLog.p2024LastHour > 0) {
      console.log(`      P2024 (pool exhausted) last hour: ${errorLog.p2024LastHour}`);
    }
    console.log(`      Log size: ${errorLog.fileSizeKb}KB (${errorLog.totalLines} lines)`);
  }

  console.log('='.repeat(60));
}

run();
