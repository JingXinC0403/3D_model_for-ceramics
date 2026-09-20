// One Blynk client for the box, kept alive so its bulk-vs-per-pin discovery persists.

import { createClient } from './blynk.js';
import { createMockClient } from './mock.js';
import { BOX, isMock } from './box.js';

let client = null;

export function boxClient() {
  if (!client) {
    client = isMock()
      ? createMockClient()
      : createClient({ token: BOX.token, region: BOX.region });
  }
  return client;
}
