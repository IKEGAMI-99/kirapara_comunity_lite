const DEFAULT_BASE_URL = 'https://ssp-projecti-jp.archosaur.com';
const DEFAULT_GAME_ID = '22701201';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function hasCredentials() {
  return ['KRPR_SERVER_ID', 'KRPR_SIGN', 'KRPR_USER_ID', 'KRPR_ROLE_ID']
    .every((name) => Boolean(process.env[name]?.trim()));
}

export function getCredentials() {
  return {
    baseUrl: process.env.KRPR_API_BASE?.trim() || DEFAULT_BASE_URL,
    serverId: requiredEnv('KRPR_SERVER_ID'),
    gameId: process.env.KRPR_GAME_ID?.trim() || DEFAULT_GAME_ID,
    sign: requiredEnv('KRPR_SIGN'),
    userId: requiredEnv('KRPR_USER_ID'),
    roleId: requiredEnv('KRPR_ROLE_ID'),
    timestamp: process.env.KRPR_TIMESTAMP?.trim() || String(Date.now()),
    hasFixedTimestamp: Boolean(process.env.KRPR_TIMESTAMP?.trim()),
  };
}

/**
 * JSON.parse loses precision for momentId because the API emits 64-bit ids as
 * bare JSON numbers. Quote known ID fields before parsing so the original
 * decimal representation survives exactly.
 */
export function parseApiJson(text) {
  const idKeys = [
    'momentId',
    'gameId',
    'roleId',
    'serverId',
    'subjectId',
    'subjectTypeId',
    'raceId',
    'npcId',
  ];

  const pattern = new RegExp(`(\"(?:${idKeys.join('|')})\"\\s*:\\s*)(-?\\d+)`, 'g');
  return JSON.parse(text.replace(pattern, '$1\"$2\"'));
}

async function requestSsp(endpoint, credentials, extraParams, timestamp) {
  const url = new URL(endpoint, credentials.baseUrl);
  const params = {
    serverId: credentials.serverId,
    gameId: credentials.gameId,
    sign: credentials.sign,
    timestamp,
    userId: credentials.userId,
    roleId: credentials.roleId,
    ...extraParams,
  };

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'User-Agent': 'X-UnrealEngine-Agent',
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SSP HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return { json: parseApiJson(text), text };
}

export async function postSsp(endpoint, extraParams = {}) {
  const credentials = getCredentials();

  let result = await requestSsp(
    endpoint,
    credentials,
    extraParams,
    credentials.timestamp,
  );

  // The first GitHub-side replay returned retcode 40020 with the captured
  // timestamp. Try one controlled request using the current millisecond time.
  // This helps distinguish timestamp freshness from a stale sign/session.
  if (result.json?.retcode === 40020 && credentials.hasFixedTimestamp) {
    const currentTimestamp = String(Date.now());
    if (currentTimestamp !== credentials.timestamp) {
      console.warn('SSP retcode=40020 with fixed timestamp; retrying once with current timestamp.');
      result = await requestSsp(endpoint, credentials, extraParams, currentTimestamp);
    }
  }

  if (result.json?.retcode !== 0) {
    throw new Error(
      `SSP retcode=${result.json?.retcode ?? 'unknown'}: ${result.text.slice(0, 500)}`,
    );
  }

  return result.json;
}
