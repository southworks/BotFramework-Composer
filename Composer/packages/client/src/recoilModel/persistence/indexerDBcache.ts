// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { LgFile } from '@botframework-composer/types';
import Dexie, { Table } from 'dexie';

// export interface Files {
//   projectid: string;
//   lgFileId: string;
//   lgfile: LgFile;
// }

export class IndexedDBCache extends Dexie {
  public projects!: Table<any, string>;
  //public projects!: Table<Files>;
  //public projects!: { projectId: string; fileId: string; file: LgFile }; //Table<LgFile, string>;

  public constructor() {
    super('LgCacheDatabase');
    this.version(1).stores({
      projects: '',
      //projects: '[projectId+lgFileId], LgFile',
    });
  }
}
