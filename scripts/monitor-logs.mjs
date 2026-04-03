#!/usr/bin/env node
/**
 * monitor-logs.mjs — CoopereAI Log Monitor
 * Reads logs/nest-error.log, groups errors by type/frequency,
 * detects P2024/critical patterns, outputs JSON + human summary.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = resolve(__dirname, '..', 'logs', 'nest-error.log');

const CRITICAL_PATTERNS = [
  { name: 'P2024_CONNECTION_POOL', regex: /code:\s*'P2024'/i, severity: 'critical', desc: 'Prisma connection pool exhausted' },
  { name: 'P1001_AUTH_FAILED', regex: /code:\s*'P1001'/i, severity: 'critical', desc: 'Database authentication failed' },
  { name: 'P2002_UNIQUE_VIOLATION', regex: /code:\s*'P2002'/i, severity: 'high', desc: 'Unique constraint violation' },
  { name: 'UNHANDLED_REJECTION', regex: /unhandledRejection/i, severity: 'critical', desc: 'Unhandled promise rejection' },
  { name: 'CRON_MISSED', regex: /Missed execution deadline/i, severity: 'high', desc: 'Cron job missed execution deadline' },
  { name: 'SYNTAX_ERROR', regex: /SyntaxError:/i, severity: 'high', desc: 'JavaScript SyntaxError at startup' },
  { name: 'TYPE_ERROR', regex: /TypeError:/i, severity: 'medium', desc: 'Runtime TypeError' },
  { name: 'ECONNREFUSED', regex: /ECONNREFUSED/i, severity: 'high', desc: 'Connection refused (service down?)' },
  { name: 'ENOTFOUND', regex: /ENOTFOUND/i, severity: 'high', desc: 'DNS resolution failed' },
  { name: 'OOM_KILLED', regex: /JavaScript heap out of memory/i, severity: 'critical', desc: 'Out of memory' },
];

function parseLogLines(content) {
  const lines = content.split('\n');
  const entries = [];
  let current = null;

  for (const line of lines) {
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s*(.*)/);
    if (timestampMatch) {
      if (current) entries.push(current);
      current = { timestamp: timestampMatch[1], text: timestampMatch[2] };
    } else if (current) {
      current.text += '\n' + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function classifyEntry(entry) {
  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.regex.test(entry.text)) {
      return { ...pattern };
    }
  }
  const clean = entry.text.replace(/\x1b\[[0-9;]*m/g, '');
  const errorMatch = clean.match(/\bERROR\b.*?\[([^\]]+)\]/);
  if (errorMatch) {
    const context = errorMatch[1].trim();
    return { name: `NEST_${context.toUpperCase().replace(/\s+/g, '_')}`, severity: 'medium', desc: `NestJS [${context}] error` };
  }
  return { name: 'UNKNOWN', severity: 'low', desc: 'Unclassified error' };
}

function analyze(entries) {
  const groups = {};
  const timeline = {};
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const entry of entries) {
    const classification = classifyEntry(entry);
    const key = classification.name;

    if (!groups[key]) {
      groups[key] = {
        name: key,
        severity: classification.severity,
        description: classification.desc,
        count: 0,
        countLast24h: 0,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        sampleMessage: '',
      };
    }

    const g = groups[key];
    g.count++;
    g.lastSeen = entry.timestamp;
    if (!g.sampleMessage) {
      g.sampleMessage = entry.text.slice(0, 200).replace(/\x1b\[[0-9;]*m/g, '');
    }

    const entryDate = new Date(entry.timestamp.replace(' ', 'T'));
    if (entryDate >= last24h) {
      g.countLast24h++;
    }

    const hour = entry.timestamp.slice(0, 13);
    timeline[hour] = (timeline[hour] || 0) + 1;
  }

  return { groups, timeline };
}

function run() {
  if (!existsSync(LOG_PATH)) {
    const result = {
      status: 'no_log_file',
      logPath: LOG_PATH,
      message: 'nest-error.log not found',
      errors: [],
      criticalAlerts: [],
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const content = readFileSync(LOG_PATH, 'utf-8');
  const entries = parseLogLines(content);
  const { groups, timeline } = analyze(entries);

  const sorted = Object.values(groups).sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4) || b.count - a.count;
  });

  const criticalAlerts = sorted.filter(g => g.severity === 'critical' && g.countLast24h > 0);

  const result = {
    status: criticalAlerts.length > 0 ? 'critical' : sorted.some(g => g.severity === 'high' && g.countLast24h > 0) ? 'warning' : 'ok',
    logPath: LOG_PATH,
    totalEntries: entries.length,
    analyzedAt: new Date().toISOString(),
    criticalAlerts: criticalAlerts.map(a => ({
      name: a.name,
      description: a.description,
      countLast24h: a.countLast24h,
      lastSeen: a.lastSeen,
    })),
    errorsByType: sorted.map(g => ({
      name: g.name,
      severity: g.severity,
      description: g.description,
      totalCount: g.count,
      countLast24h: g.countLast24h,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      sample: g.sampleMessage,
    })),
    hourlyTimeline: timeline,
  };

  console.log(JSON.stringify(result, null, 2));

  // Human-readable summary
  console.log('\n' + '='.repeat(60));
  console.log(`  CoopereAI Log Monitor — ${result.analyzedAt}`);
  console.log('='.repeat(60));
  console.log(`  Status: ${result.status.toUpperCase()}`);
  console.log(`  Total log entries: ${result.totalEntries}`);

  if (criticalAlerts.length > 0) {
    console.log('\n  CRITICAL ALERTS:');
    for (const a of criticalAlerts) {
      console.log(`    [!] ${a.name}: ${a.description} (${a.countLast24h}x last 24h, last: ${a.lastSeen})`);
    }
  }

  console.log('\n  Errors by type:');
  for (const g of sorted) {
    const marker = g.severity === 'critical' ? '[!!!]' : g.severity === 'high' ? '[!!]' : '[.]';
    console.log(`    ${marker} ${g.name} — ${g.description}`);
    console.log(`        Total: ${g.count} | Last 24h: ${g.countLast24h} | Last: ${g.lastSeen}`);
  }
  console.log('='.repeat(60));
}

run();
