// The one enclosure this installation monitors.
//
// The Blynk token is read from the environment, never committed. Put it in .env
// (see .env.example). With no token set the site runs on synthetic readings, so a
// fresh clone works before any hardware is wired up.

export const MOCK_TOKEN = 'mock';

export const BOX = {
  name: process.env.CARE_BOX_NAME ?? 'CARE Box',
  token: process.env.BLYNK_TOKEN || MOCK_TOKEN,
  region: process.env.BLYNK_REGION || 'blynk.cloud',
};

export const isMock = () => BOX.token === MOCK_TOKEN;
