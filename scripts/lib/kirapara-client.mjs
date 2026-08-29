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
    // Some captures show one timestamp reused across several requests. Keep an
    // override until the signing behaviour is understood; otherwise use now.
    timestamp: process.env.KRPR_TIMESTAMP?.trim() || String(Date.now()),
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

  const pattern = new RegExp(`("(?:${idKeys.join('|')})"\\s*:\\s*)(-?\\d+)`, 'g');
  return JSON.parse(text.replace(pattern, '$1"$2"'));
}

export async function postSsp(endpoint, extraParams = {}) {
  const credentials = getCredentials();
  const url = new URL(endpoint, credentials.baseUrl);

  const params = {
    serverId: credentials.serverId,
    gameId: credentials.gameId,
    sign: credentials.sign,
    timestamp: credentials.timestamp,
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

  const json = parseApiJson(text);
  if (json?.retcode !== 0) {
    throw new Error(`SSP retcode=${json?.retcode ?? 'unknown'}: ${text.slice(0, 500)}`);
  }

  return json;
}
