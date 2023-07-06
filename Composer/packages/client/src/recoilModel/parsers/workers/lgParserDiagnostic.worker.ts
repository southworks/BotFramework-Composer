// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { lgUtil } from '@bfc/indexers';
import { LgFile } from '@bfc/shared';

import { LgActionType, LgParsePayload } from '../types';

const ctx: Worker = self as any;

interface ParseMessage {
  id: string;
  type: LgActionType.Parse;
  payload: any;
}

type LgMessageEvent = ParseMessage;

const filterParseResult = (lgFile: LgFile) => {
  const cloned = { ...lgFile };
  // remove the parse tree from the result.
  // The parse tree has Int32Array type, can't be frozen by recoil
  delete cloned.parseResult;
  return cloned;
};

export const handleMessage = (msg: LgMessageEvent) => {
  const { id, content, lgFiles } = msg.payload;
  const lgFile = lgUtil.parse(id, content, lgFiles);
  return filterParseResult(lgFile);
};

ctx.onmessage = async function (event) {
  const msg = event.data as LgMessageEvent;

  try {
    if (msg.id == null) {
      const lgFiles = msg.payload.chunks.map((e) => {
        return new Promise((res) => {
          setTimeout(() => {
            const lgFile = lgUtil.parse(e.id, e.content, msg.payload.lgFiles);
            res(filterParseResult(lgFile));
          }, 0);
        });
      });
      const payload = await Promise.all(lgFiles);
      ctx.postMessage({ id: msg.id, payload });
    } else {
      const payload = handleMessage(msg);
      ctx.postMessage({ id: msg.id, payload });
    }
  } catch (error) {
    ctx.postMessage({ id: msg.id, error: error.message });
  }
};
