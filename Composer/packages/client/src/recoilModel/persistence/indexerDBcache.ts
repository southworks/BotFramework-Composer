// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IDiagnostic, LgTemplate } from '@botframework-composer/types';
import { Templates } from 'botbuilder-lg';
import Dexie, { Table } from 'dexie';

export class Project {
  id?: string;
  content?: string;
  diagnostics?: IDiagnostic[];
  templates?: LgTemplate[];
  allTemplates?: LgTemplate[];
  imports?: { id: string; path: string; description: string }[];
  options?: string[];
  parseResult?: Templates;
  isContentUnparsed?: boolean;
}

export class LgResources {
  lgResources?: Map<string, Project>;
}

export class IndexedDBCache extends Dexie {
  public projects!: Table<any, string>;
  public parseResult!: Table<Templates, string>;
  //public projects!: Table<Files>;
  //public projects!: { projectId: string; fileId: string; file: LgFile }; //Table<LgFile, string>;

  public constructor() {
    super('LgCacheDatabase');
    this.version(1).stores({
      projects: '',
      parseResult: 'id',
      //projects: '[projectId+lgFileId], LgFile',
    });
    //this.parseResult.mapToClass(Templates);
  }
}
