'use strict';

const crypto = require('crypto');
const fetch = require('node-fetch');
const { settingsDb } = require('./db');

const REGION_URLS = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com'
};

function getTuyaSettings() {
  const s = settingsDb.get('tuya').value();
  return s;
}

function getBaseUrl() {
  const s = getTuyaSettings();
  return REGION_URLS[s.region] || REGION_URLS.eu;
}

function hmacSha256(message, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
    .toUpperCase();
}

function buildSign(accessId, accessSecret, t, nonce, accessToken, method, path, body = '') {
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const url = path;
  const stringToSign = [method, contentHash, '', url].join('\n');
  const signStr = accessToken
    ? accessId + accessToken + t + nonce + stringToSign
    : accessId + t + nonce + stringToSign;
  return hmacSha256(signStr, accessSecret);
}

async function getAccessToken() {
  const { accessId, accessSecret } = getTuyaSettings();
  if (!accessId || !accessSecret) {
    throw new Error('Tuya API credentials not configured. Please set them in Settings.');
  }

  const baseUrl = getBaseUrl();
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const path = '/v1.0/token?grant_type=1';
  const sign = buildSign(accessId, accessSecret, t, nonce, '', 'GET', path);

  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      client_id: accessId,
      sign,
      t,
      nonce,
      sign_method: 'HMAC-SHA256'
    }
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya auth failed: ${data.msg || JSON.stringify(data)}`);
  }
  return data.result.access_token;
}

async function tuyaRequest(method, urlPath, body = null) {
  const { accessId, accessSecret } = getTuyaSettings();
  if (!accessId || !accessSecret) {
    throw new Error('Tuya API credentials not configured. Please set them in Settings.');
  }

  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = buildSign(accessId, accessSecret, t, nonce, accessToken, method, urlPath, bodyStr);

  const headers = {
    client_id: accessId,
    access_token: accessToken,
    sign,
    t,
    nonce,
    sign_method: 'HMAC-SHA256'
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? bodyStr : undefined
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya API error: ${data.msg || JSON.stringify(data)}`);
  }
  return data.result;
}

async function getDevices() {
  const { userId } = getTuyaSettings();
  if (!userId) {
    throw new Error('Tuya User ID not configured. Please set it in Settings.');
  }
  return await tuyaRequest('GET', `/v1.0/users/${userId}/devices`);
}

async function getDevice(deviceId) {
  return await tuyaRequest('GET', `/v1.0/devices/${deviceId}`);
}

async function getDeviceStatus(deviceId) {
  return await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
}

async function sendDeviceCommand(deviceId, commands) {
  return await tuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
}

async function toggleDevice(deviceId, on) {
  return await sendDeviceCommand(deviceId, [{ code: 'switch_1', value: on }]);
}

module.exports = {
  getDevices,
  getDevice,
  getDeviceStatus,
  sendDeviceCommand,
  toggleDevice
};
