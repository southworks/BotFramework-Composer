// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { LgFile } from '@bfc/shared';

import Worker from './workers/lgParserDiagnostic.worker.ts';
import { BaseWorker } from './baseWorker';
import { LgActionType, LgParsePayload } from './types';
import { chunk } from 'lodash';

// Wrapper class
class LgWorker extends BaseWorker<LgActionType> {
  parse(projectId: string, id: string, content: string, lgFiles: LgFile[]) {
    return this.sendMsg<LgParsePayload>(LgActionType.Parse, { id, content, lgFiles, projectId });
  }

  async parseAll(lgFiles: LgFile[]) {
    // const chunks = chunk(lgFiles, 3);
    const chunks = [lgFiles.slice(0, 6), lgFiles.slice(6, 12), lgFiles.slice(12, 18), lgFiles.slice(18, 24)];
    console.time('lgFiles');
    var startDate = new Date();
    const worker1 = new Worker();
    const worker2 = new Worker();
    // const worker2 = worker1;
    const worker3 = new Worker();
    const worker4 = new Worker();
    console.log(navigator.hardwareConcurrency)
    const result = chunks.map((chunks, ix) => {
      const i = ix;
      if (i == 0) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            worker1.onmessage = ({ data }) => {
              var endDate = new Date();
              var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
              console.log(`finished parsing, index:${i}, seconds:${seconds}`, data);
              resolve(data);
            };
            worker1.onerror = reject;
            worker1.postMessage({ payload: { chunks, lgFiles } });
          }, 0);
        });
      } else if (i == 1) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            worker2.onmessage = ({ data }) => {
              var endDate = new Date();
              var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
              console.log(`finished parsing, index:${i}, seconds:${seconds}`, data);
              resolve(data);
            };
            worker2.onerror = reject;
            worker2.postMessage({ payload: { chunks, lgFiles } });
          }, 0);
        });
      } else if (i == 2) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            worker3.onmessage = ({ data }) => {
              var endDate = new Date();
              var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
              console.log(`finished parsing, index:${i}, seconds:${seconds}`, data);
              resolve(data);
            };
            worker3.onerror = reject;
            worker3.postMessage({ payload: { chunks, lgFiles } });
          }, 0);
        });
      } else {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            worker4.onmessage = ({ data }) => {
              var endDate = new Date();
              var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
              console.log(`finished parsing, index:${i}, seconds:${seconds}`, data);
              resolve(data);
            };
            worker4.onerror = reject;
            worker4.postMessage({ payload: { chunks, lgFiles } });
          }, 0);
        });
      }
    });

    const r = await Promise.all(result);
    console.timeEnd('lgFiles');
    return r;
  }
}

export default new LgWorker(new Worker());
