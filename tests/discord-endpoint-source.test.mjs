import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CREATE_THREAD_ROUTE = new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url);

async function readCreateThreadRoute() {
  const source = await readFile(CREATE_THREAD_ROUTE, 'utf8');
  return { source, body: source.slice(source.indexOf('export async function GET')) };
}

function createThreadStepIndexes(body) {
  return {
    dryRun: body.indexOf('if (dryRun)'),
    optionsRead: body.lastIndexOf('await readRoleOptions()'),
    create: body.indexOf('await createForumThread'),
    archive: body.indexOf('await archivePreviousThread'),
    dropdowns: body.indexOf('await sendRoleDropdowns'),
  };
}

test('create-thread cron dryRun returns before any Discord write', async () => {
  const { body } = await readCreateThreadRoute();
  const step = createThreadStepIndexes(body);

  for (const [name, index] of Object.entries(step)) {
    assert.notEqual(index, -1, `missing step: ${name}`);
  }

  assert.ok(step.dryRun < step.create);
  assert.ok(step.dryRun < step.archive);
  assert.ok(step.dryRun < step.dropdowns);

  const dryRunGuard = body.slice(step.dryRun, Math.min(step.create, step.archive, step.dropdowns));
  assert.match(dryRunGuard, /return NextResponse\.json/);
  assert.doesNotMatch(dryRunGuard, /archivePreviousThread|createForumThread|sendRoleDropdowns|sendDropdownMessage/);
  assert.match(dryRunGuard, /wouldArchiveThread/);
});

test('create-thread cron dryRun exercises the role options read', async () => {
  // A dry run that skipped the Sheets call could not detect the stalled request
  // that cost a full week's thread, which is the whole point of having one.
  const { body } = await readCreateThreadRoute();
  const step = createThreadStepIndexes(body);
  const dryRunGuard = body.slice(step.dryRun, Math.min(step.create, step.archive, step.dropdowns));

  assert.match(dryRunGuard, /await readRoleOptions\(\)/);
  assert.match(dryRunGuard, /roleOptionCount/);
  assert.match(dryRunGuard, /roleOptionsError/);
});

test('create-thread cron creates the thread before archiving the previous one', async () => {
  // Archiving last week's thread is cleanup. Doing it first meant an archive
  // failure aborted the run and left the week with no thread at all.
  const { body } = await readCreateThreadRoute();
  const step = createThreadStepIndexes(body);

  assert.ok(step.create < step.archive);
  assert.ok(step.create < step.dropdowns);
});

test('create-thread cron never lets the role options read abort thread creation', async () => {
  const { source, body } = await readCreateThreadRoute();
  const step = createThreadStepIndexes(body);

  assert.match(source, /readRoleOptionsWithFallback/);
  assert.doesNotMatch(source, /readRoleOptionsFromSheet/);

  const helper = source.slice(
    source.indexOf('async function readRoleOptions('),
    source.indexOf('async function archivePreviousThread'),
  );
  assert.match(helper, /try \{/);
  assert.match(helper, /catch \(error\)/);
  assert.match(helper, /options: \[\]/);

  assert.ok(step.optionsRead < step.create);
  const betweenReadAndCreate = body.slice(step.optionsRead, step.create);
  assert.doesNotMatch(betweenReadAndCreate, /\breturn\b|\bthrow\b/);
});

test('create-thread cron contains archive and dropdown failures', async () => {
  const { source } = await readCreateThreadRoute();

  const archiveHelper = source.slice(
    source.indexOf('async function archivePreviousThread'),
    source.indexOf('async function sendRoleDropdowns'),
  );
  assert.match(archiveHelper, /catch \(error\)/);

  const dropdownHelper = source.slice(
    source.indexOf('async function sendRoleDropdowns'),
    source.indexOf('async function reportWarningsToThread'),
  );
  assert.match(dropdownHelper, /catch \(error\)/);
});

test('create-thread cron skips creation when the week already has a thread', async () => {
  const { body } = await readCreateThreadRoute();
  const step = createThreadStepIndexes(body);

  assert.match(body, /selectWorshipThreadBySundayDate/);
  const existingGuard = body.indexOf('if (existingThread)');
  assert.notEqual(existingGuard, -1);
  assert.ok(existingGuard < step.create);
});

test('create-thread cron reports partial failures into the thread', async () => {
  const { body } = await readCreateThreadRoute();

  assert.match(body, /const warnings = /);
  assert.match(body, /await reportWarningsToThread\(thread\.id, warnings\)/);
});

test('manual worship thread action validates and initializes before setting active thread', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  const body = source.slice(source.indexOf('export async function createWeeklyWorshipThread'));
  const optionsReadIndex = body.indexOf('await readRoleOptionsWithFallback');
  const archiveThreadIndex = body.indexOf('await archiveThread');
  const createThreadIndex = body.indexOf('await createForumThread');
  const firstDropdownIndex = body.indexOf('await sendDropdownMessage');
  const markProcessedIndex = body.indexOf('await markMessageProcessed');
  const setActiveThreadIndex = body.indexOf('await setActiveThread');

  assert.notEqual(optionsReadIndex, -1);
  assert.notEqual(archiveThreadIndex, -1);
  assert.notEqual(createThreadIndex, -1);
  assert.notEqual(firstDropdownIndex, -1);
  assert.notEqual(markProcessedIndex, -1);
  assert.notEqual(setActiveThreadIndex, -1);
  assert.ok(optionsReadIndex < createThreadIndex);
  // Create first, then archive: cleanup must never cost this week's thread.
  assert.ok(createThreadIndex < archiveThreadIndex);
  assert.ok(createThreadIndex < firstDropdownIndex);
  assert.ok(markProcessedIndex < setActiveThreadIndex);
});

test('manual worship thread action swallows archive failures and skips duplicates', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  const body = source.slice(
    source.indexOf('export async function createWeeklyWorshipThread'),
    source.indexOf('export async function parseActiveWorshipThreadComments'),
  );

  assert.match(body, /selectWorshipThreadBySundayDate/);
  assert.match(body, /if \(existingThread\)/);

  const archiveBlock = body.slice(body.indexOf('if (previousThread)'), body.indexOf('const messageIds'));
  assert.match(archiveBlock, /try \{/);
  assert.match(archiveBlock, /catch \(error\)/);
});

test('send-week-dropdown requires cron authorization before Discord side effects', async () => {
  const source = await readFile(
    new URL('../app/api/discord/send-week-dropdown/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /NextRequest/);
  assert.match(source, /isCronAuthorized/);

  const body = source.slice(source.indexOf('export async function POST'));
  const authIndex = body.indexOf('isCronAuthorized');
  const firstDiscordReadIndex = Math.min(
    body.indexOf('getChannel('),
    body.indexOf('getActiveForumThreads('),
  );

  assert.ok(authIndex !== -1 && firstDiscordReadIndex !== -1);
  assert.ok(authIndex < firstDiscordReadIndex);
  assert.match(body, /status:\s*401/);
});

test('parse-comments requires cron authorization before Discord and Google side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/parse-comments/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /isCronAuthorized/);

  const body = source.slice(source.indexOf('export async function GET'));
  const authIndex = body.indexOf('isCronAuthorized');
  const sideEffectIndexes = [
    body.indexOf('getChannel('),
    body.indexOf('getActiveForumThreads('),
    body.indexOf('getThreadMessages('),
    body.indexOf('findRowByDate('),
    body.indexOf('updateWorshipData('),
    body.indexOf('addMessageReaction('),
  ].filter((index) => index !== -1);

  assert.notEqual(authIndex, -1);
  assert.ok(sideEffectIndexes.length > 0);
  assert.ok(sideEffectIndexes.every((index) => authIndex < index));
  assert.match(body, /status:\s*401/);
});

test('check-worship-prep-ready cron requires auth before side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/check-worship-prep-ready/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /isCronAuthorized/);
  assert.match(source, /getCurrentOrUpcomingSundayDate/);
  assert.match(source, /day === 0 \? 0 : 7 - day/);

  const body = source.slice(source.indexOf('export async function GET'));
  const authIndex = body.indexOf('isCronAuthorized');
  const notificationIndex = body.indexOf('checkAndSendWorshipPrepReadyNotification(');

  assert.notEqual(authIndex, -1);
  assert.notEqual(notificationIndex, -1);
  assert.ok(authIndex < notificationIndex);
  assert.match(body, /status:\s*401/);
});

test('vercel config schedules worship prep readiness recovery every 10 minutes', async () => {
  const source = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
  const config = JSON.parse(source);

  assert.ok(
    config.crons.some(
      (cron) =>
        cron.path === '/api/cron/discord/check-worship-prep-ready' &&
        cron.schedule === '*/10 * * * *',
    ),
  );
});

test('discord client archives worship threads without locking them', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/discord-client.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /export async function archiveThread/);
  assert.match(source, /method:\s*'PATCH'/);
  assert.match(source, /archived:\s*true/);

  const archiveFunction = source.slice(
    source.indexOf('export async function archiveThread'),
    source.indexOf('export async function', source.indexOf('export async function archiveThread') + 1),
  );
  assert.doesNotMatch(archiveFunction, /locked/);
});

test('discord client sends plain messages to a thread channel', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/discord-client.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /export async function sendThreadMessage/);
  assert.match(source, /\/channels\/\$\{threadId\}\/messages/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*content/);
});

test('interactions route checks worship prep readiness after role sheet updates', async () => {
  const source = await readFile(
    new URL('../app/api/discord/interactions/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /import \{ NextRequest, NextResponse, after \} from 'next\/server'/);
  assert.match(source, /checkAndSendWorshipPrepReadyNotification/);
  assert.match(source, /async function safelyCheckWorshipPrepReadyNotification/);

  const helper = source.slice(
    source.indexOf('async function safelyCheckWorshipPrepReadyNotification'),
    source.indexOf('export async function POST'),
  );
  assert.match(helper, /try\s*\{/);
  assert.match(helper, /catch\s*\(\s*error\s*\)/);
  assert.match(helper, /checkAndSendWorshipPrepReadyNotification\(input\)/);

  const body = source.slice(source.indexOf('export async function POST'));
  const updateIndex = body.indexOf('await updateRoleSelectionInSheet(customId, selectedValue, sundayDate);');
  const notifyIndex = body.indexOf('after(() => safelyCheckWorshipPrepReadyNotification');
  const returnIndex = body.indexOf('return NextResponse.json', notifyIndex);

  assert.notEqual(updateIndex, -1);
  assert.notEqual(notifyIndex, -1);
  assert.notEqual(returnIndex, -1);
  assert.ok(updateIndex < notifyIndex);
  assert.ok(notifyIndex < returnIndex);
  assert.match(body, /after\(\(\) => safelyCheckWorshipPrepReadyNotification\(\{\s*sundayDate,\s*origin:\s*new URL\(request\.url\)\.origin\s*\}\)\)/);
});

test('parse-comments cron checks worship prep readiness after worship data updates', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/parse-comments/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /checkAndSendWorshipPrepReadyNotification/);
  assert.match(source, /async function safelyCheckWorshipPrepReadyNotification/);

  const helper = source.slice(
    source.indexOf('async function safelyCheckWorshipPrepReadyNotification'),
    source.indexOf('export async function GET'),
  );
  assert.match(helper, /try\s*\{/);
  assert.match(helper, /catch\s*\(\s*error\s*\)/);
  assert.match(helper, /checkAndSendWorshipPrepReadyNotification\(input\)/);

  const body = source.slice(source.indexOf('export async function GET'));
  const updateIndex = body.indexOf('await updateWorshipData(SHEET_NAME, targetRow, mergedData);');
  const notifyIndex = body.indexOf('await safelyCheckWorshipPrepReadyNotification');

  assert.notEqual(updateIndex, -1);
  assert.notEqual(notifyIndex, -1);
  assert.ok(updateIndex < notifyIndex);
  assert.match(body, /safelyCheckWorshipPrepReadyNotification\(\{\s*sundayDate:\s*activeThread\.sundayDate,\s*origin:\s*new URL\(request\.url\)\.origin\s*\}\)/);
});

test('manual worship prep parse action checks readiness after worship data updates', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /checkAndSendWorshipPrepReadyNotification/);
  assert.match(source, /async function safelyCheckWorshipPrepReadyNotification/);

  const helper = source.slice(
    source.indexOf('async function safelyCheckWorshipPrepReadyNotification'),
    source.indexOf('export async function createWeeklyWorshipThread'),
  );
  assert.match(helper, /try\s*\{/);
  assert.match(helper, /catch\s*\(\s*error\s*\)/);
  assert.match(helper, /checkAndSendWorshipPrepReadyNotification\(input\)/);

  const body = source.slice(source.indexOf('export async function parseActiveWorshipThreadComments'));
  const updateIndex = body.indexOf('await updateWorshipData(SHEET_NAME, targetRow, mergedData);');
  const notifyIndex = body.indexOf('await safelyCheckWorshipPrepReadyNotification');

  assert.notEqual(updateIndex, -1);
  assert.notEqual(notifyIndex, -1);
  assert.ok(updateIndex < notifyIndex);
  assert.match(body, /safelyCheckWorshipPrepReadyNotification\(\{\s*sundayDate:\s*activeThread\.sundayDate\s*\}\)/);
});

test('manual worship prep automation resolves the current Discord forum thread before stored state', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /selectTargetWorshipThread/);

  const helper = source.slice(
    source.indexOf('async function getCurrentWorshipThread'),
    source.indexOf('export async function createWeeklyWorshipThread'),
  );
  assert.match(helper, /getActiveForumThreads\(guildId,\s*channelId\)/);
  assert.match(helper, /selectTargetWorshipThread/);
  assert.match(helper, /await setActiveThread\(selected\.id,\s*selected\.sundayDate\)/);
  assert.match(helper, /const activeThread = await getActiveThread\(\)/);

  const parseBody = source.slice(
    source.indexOf('export async function parseActiveWorshipThreadComments'),
    source.indexOf('export async function resendWorshipRoleDropdowns'),
  );
  assert.match(parseBody, /const activeThread = await getCurrentWorshipThread\(\)/);

  const resendBody = source.slice(source.indexOf('export async function resendWorshipRoleDropdowns'));
  assert.match(resendBody, /const activeThread = await getCurrentWorshipThread\(\)/);
});

test('manual worship prep parse action ignores bot messages', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  const body = source.slice(
    source.indexOf('export async function parseActiveWorshipThreadComments'),
    source.indexOf('export async function resendWorshipRoleDropdowns'),
  );

  assert.match(body, /!message\.author\.bot/);
});

test('conti actions check worship prep readiness after create and update', async () => {
  const source = await readFile(
    new URL('../lib/actions/contis.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /checkAndSendWorshipPrepReadyNotification/);
  assert.match(source, /toYYMMDDFromIsoDate/);
  assert.match(source, /async function safelyCheckWorshipPrepReadyNotification/);
  assert.match(source, /async function safelyCheckWorshipPrepReadyNotificationForIsoDate/);

  const helper = source.slice(
    source.indexOf('async function safelyCheckWorshipPrepReadyNotificationForIsoDate'),
    source.indexOf('export async function createConti'),
  );
  assert.match(helper, /try\s*\{/);
  assert.match(helper, /catch\s*\(\s*error\s*\)/);
  assert.match(helper, /toYYMMDDFromIsoDate\(isoDate\)/);
  assert.match(helper, /safelyCheckWorshipPrepReadyNotification\(\{\s*sundayDate\s*\}\)/);

  const createBody = source.slice(
    source.indexOf('export async function createConti'),
    source.indexOf('export async function updateConti'),
  );
  const createRevalidateIndex = createBody.indexOf("revalidatePath('/contis');");
  const createNotifyIndex = createBody.indexOf('await safelyCheckWorshipPrepReadyNotificationForIsoDate(conti.date);');
  assert.notEqual(createRevalidateIndex, -1);
  assert.notEqual(createNotifyIndex, -1);
  assert.ok(createRevalidateIndex < createNotifyIndex);

  const updateBody = source.slice(
    source.indexOf('export async function updateConti'),
    source.indexOf('export async function deleteConti'),
  );
  const updateRevalidateIndex = updateBody.indexOf("revalidatePath('/contis');");
  const updateNotifyIndex = updateBody.indexOf('await safelyCheckWorshipPrepReadyNotificationForIsoDate(result.date);');
  assert.notEqual(updateRevalidateIndex, -1);
  assert.notEqual(updateNotifyIndex, -1);
  assert.ok(updateRevalidateIndex < updateNotifyIndex);
});

test('discord and sheets clients bound every outbound request', async () => {
  // The 260906 thread was lost to a Sheets GET that was accepted and never
  // answered: it held the invocation open until Vercel killed it at maxDuration,
  // so archiving and thread creation never ran. A bare fetch here brings that back.
  for (const relativePath of ['../lib/discord-sync/discord-client.ts', '../lib/discord-sync/google-sheets.ts']) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');

    assert.match(source, /fetchWithTimeout/, `${relativePath} should use fetchWithTimeout`);
    assert.doesNotMatch(source, /await fetch\(/, `${relativePath} has an unbounded fetch`);
    assert.doesNotMatch(source, /=\s*fetch\(/, `${relativePath} has an unbounded fetch`);
  }
});

test('discord write helpers never retry, so a retry cannot duplicate a thread', async () => {
  const source = await readFile(new URL('../lib/discord-sync/discord-client.ts', import.meta.url), 'utf8');

  for (const label of ['Create forum thread', 'Send dropdown message', 'Send thread message', 'Archive thread']) {
    const callIndex = source.indexOf(`label: '${label}'`);
    assert.notEqual(callIndex, -1, `missing bounded call for ${label}`);

    const optionsStart = source.lastIndexOf('{', callIndex);
    assert.doesNotMatch(source.slice(optionsStart, callIndex), /retries:/, `${label} must not retry`);
  }
});

test('select options stay inside Discord component limits', async () => {
  const source = await readFile(new URL('../lib/discord-sync/discord-client.ts', import.meta.url), 'utf8');

  assert.match(source, /MAX_SELECT_OPTIONS = 25/);
  assert.match(source, /MAX_SELECT_FIELD_LENGTH = 100/);
  assert.match(source, /options: toSelectOptions\(options\)/);
});

test('the spell checker cannot hold the parse cron open', async () => {
  const source = await readFile(new URL('../lib/discord-sync/spell-checker.ts', import.meta.url), 'utf8');

  assert.match(source, /AbortSignal\.timeout\(SPELLER_TIMEOUT_MS\)/);
});
