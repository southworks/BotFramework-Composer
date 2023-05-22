// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { lgUtil } from '@bfc/indexers';

import { TextFile } from '@bfc/shared';

const ctx: Worker = self as any;

export const handleMessage = (lgResources: TextFile[]) => {
  const result = lgResources.map(({ id, content }) => {
    return lgUtil.parse(id, content, lgResources);
  });
  return result;
};

ctx.onmessage = function (event) {
  console.log('ParseAll.worker');

  try {
    const payload = handleMessage(event.data);
    ctx.postMessage(payload);
  } catch (error) {
    ctx.postMessage({ error: error.message });
  }
};
