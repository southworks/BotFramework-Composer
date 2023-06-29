// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { lgUtil } from '@bfc/indexers';
import { lgImportResolverGenerator, LgFile as LgFileOriginal } from '@bfc/shared';
import Dexie, { Table } from 'dexie';

import {
  LgActionType,
  LgParsePayload,
  LgUpdateTemplatePayload,
  LgCreateTemplatePayload,
  LgCreateTemplatesPayload,
  LgRemoveTemplatePayload,
  LgRemoveAllTemplatesPayload,
  LgCopyTemplatePayload,
  LgNewCachePayload,
  LgCleanCachePayload,
  LgParseAllPayload,
  LgGetlPayload,
} from '../types';

import { useEffect, useRef } from 'react';

export default function useOnChange<T>(value: T, effect: (prev: T, next: T) => void) {
  const latestValue = useRef(value);
  const callback = useRef(effect);
  callback.current = effect;

  useEffect(
    function onChange() {
      if (value !== latestValue.current) {
        callback.current(latestValue.current, value);
      }
    },
    [value]
  );
}

const ctx: Worker = self as any;

interface ParseMessage {
  id: string;
  type: LgActionType.Parse;
  payload: LgParsePayload;
}

interface AddMessage {
  id: string;
  type: LgActionType.AddTemplate;
  payload: LgCreateTemplatePayload;
}

interface AddsMessage {
  id: string;
  type: LgActionType.AddTemplates;
  payload: LgCreateTemplatesPayload;
}

interface UpdateMessage {
  id: string;
  type: LgActionType.UpdateTemplate;
  payload: LgUpdateTemplatePayload;
}

interface RemoveMessage {
  id: string;
  type: LgActionType.RemoveTemplate;
  payload: LgRemoveTemplatePayload;
}

interface RemoveAllMessage {
  id: string;
  type: LgActionType.RemoveAllTemplates;
  payload: LgRemoveAllTemplatesPayload;
}

interface CopyMessage {
  id: string;
  type: LgActionType.CopyTemplate;
  payload: LgCopyTemplatePayload;
}

interface CopyMessage {
  id: string;
  type: LgActionType.CopyTemplate;
  payload: LgCopyTemplatePayload;
}

interface NewCacheMessage {
  id: string;
  type: LgActionType.NewCache;
  payload: LgNewCachePayload;
}

interface CleanCacheMeassage {
  id: string;
  type: LgActionType.CleanCache;
  payload: LgCleanCachePayload;
}

type ParseAllMessage = {
  id: string;
  type: LgActionType.ParseAll;
  payload: LgParseAllPayload;
};

type GetMessage = {
  id: string;
  type: LgActionType.Get;
  payload: LgGetlPayload;
};

type LgMessageEvent =
  | NewCacheMessage
  | CleanCacheMeassage
  | ParseMessage
  | AddMessage
  | AddsMessage
  | UpdateMessage
  | RemoveMessage
  | RemoveAllMessage
  | CopyMessage
  | ParseAllMessage
  | GetMessage;

type LgResources = Map<string, LgFile>;

interface LgFile extends LgFileOriginal {
  projectId: string;
}

const lgFileResolver = (lgFiles) => {
  return lgImportResolverGenerator(lgFiles, '.lg');
};

class IndexedDBCache extends Dexie {
  public files!: Table<LgFile, string>;

  public constructor() {
    super('LgDatabase');
    this.version(1).stores({
      files: '[projectId+id],[id+projectId]',
    });
  }
}

function isObject(objValue) {
  return objValue && typeof objValue === 'object' && !Array.isArray(objValue);
}

const structure = new Map<string, object>();

function parse(obj) {
  const process = (obj) => {
    if (!obj) {
      return obj;
    }

    const result: any = {};

    if (isObject(obj)) {
      result.__className__ = obj.constructor.name;
    }

    const methods = Object.getPrototypeOf(obj);
    const props = Object.getOwnPropertyNames(obj);
    structure.set(obj.constructor.name, methods);

    for (let propName of props) {
      const prop = obj[propName];
      if (isObject(prop)) {
        if (structure.has(prop.constructor.name)) {
        } else {
          const methods = Object.getPrototypeOf(prop);
          structure.set(prop.constructor.name, methods);
        }
        result[propName] = process(prop);
      } else if (Array.isArray(prop)) {
        result[propName] = prop.map(process);
      } else {
        result[propName] = prop;
      }
    }

    return result;
  };

  return process(obj);
}

function revive(obj) {
  if (!obj) {
    return obj;
  }
  let result = {};
  if (structure.has(obj.__className__)) {
    const methods = structure.get(obj.__className__)!;
    result = Object.create(methods);
  }

  const props = Object.getOwnPropertyNames(obj).filter((e) => e !== '__className__');
  for (let propName of props) {
    const prop = obj[propName];
    if (isObject(prop)) {
      result[propName] = revive(prop);
    } else if (Array.isArray(prop)) {
      result[propName] = prop.map(revive);
    } else {
      result[propName] = prop;
    }
  }

  return result;
}

function decycle(obj) {
  let i = 0;
  const seen = new WeakSet();
  const nullify = (obj) => {
    if (typeof obj === 'object' && obj !== null) {
      if (seen.has(obj)) {
        return null;
      }
      seen.add(obj);
      structure.set(`__decycle__${i++}__`, obj);
      Object.keys(obj).forEach((key) => {
        obj[key] = nullify(obj[key]);
      });
    }
    return obj;
  };
  return nullify(obj);
}

function retrocycle(obj) {
  let result = {};

  const props = Object.getOwnPropertyNames(obj);
  for (let propName of props) {
    const prop = obj[propName];
    if (isObject(prop)) {
      result[propName] = retrocycle(prop);
    } else if (Array.isArray(prop)) {
      result[propName] = prop.map(retrocycle);
    } else if (structure.has(obj)) {
      result[propName] = structure.get(obj);
    } else {
      result[propName] = prop;
    }
  }

  return result;
}

export class LgCache {
  public db: IndexedDBCache;
  public projectState: Map<string, string> = new Map<string, string>();
  public fileState: Map<string, string> = new Map<string, string>();
  private PROJECT_STATE = {
    READY: 'READY',
  };
  private FILE_STATE = {
    PARSING: 'PARSING',
    PARSED: 'PARSED',
  };

  constructor() {
    this.db = new IndexedDBCache();

    this.db.files.hook('reading', (file) => {
      const result = revive(file);
      return result;
    });
    this.db.files.hook('deleting', (key, file) => {
      this.fileState.delete(this.lgFileId(file.projectId, file.id));
    });
  }

  async set(projectId: string, value: LgFileOriginal) {
    const lgResources = await this.db.files.where({ projectId }).toArray();

    if (!lgResources) return;

    // update reference resource
    const collection: LgFile[] = [];
    console.dir(lgResources);
    lgResources.forEach((lgResource) => {
      if (lgResource.parseResult) {
        lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
          return ref.id === value.id ? value.parseResult : ref;
        });
        collection.push({ ...lgResource, projectId });
      }
    });

    const decycled = decycle(value);
    collection.push({ ...decycled, projectId });
    const result = collection.map((e) => {
      const parsed = parse(e);
      return JSON.parse(JSON.stringify(parsed));
    });
    await this.db.files.bulkPut(result);
    console.log(
      'IndexedDB LGFiles saved: ',
      result.map((e) => ({ id: e.id, projectId: e.projectId }))
    );
  }

  async setProject(projectId: string, lgResources: LgFile[]) {
    const files = lgResources.map(({ id, content }) => emptyLgFile(projectId, id, content));
    const result = await this.db.files.bulkAdd(files);
    this.projectState.set(projectId, this.PROJECT_STATE.READY);
    return result;
  }

  async get(projectId: string, id: string): Promise<LgFile> {
    const lgFile = await this.db.files.where({ projectId, id }).first();
    if (lgFile?.isContentUnparsed === false) {
      return lgFile!;
    }

    // Wait until the first lgFile is parsed and then continue, to avoid unnecessary parse executions.
    if (cache.isFileParsing(projectId, id)) {
      await waitUntil(() => cache.isFileParsed(projectId, id));
      const lgFile = await this.db.files.where({ projectId, id }).first();
      return lgFile!;
    }

    this.fileState.set(this.lgFileId(projectId, id), this.FILE_STATE.PARSING);
    const lgFiles = await cache.getByProjectId(projectId);
    const parsed = lgUtil.parse(lgFile!.id, lgFile!.content, lgFiles);
    await cache.set(projectId, parsed);
    this.fileState.set(this.lgFileId(projectId, id), this.FILE_STATE.PARSED);

    return { ...parsed, projectId };
  }

  async getByProjectId(projectId: string, filter?: (obj: any) => boolean) {
    const result = await this.db.files.filter((val) => (val.id === projectId && filter ? filter(val) : true)).toArray();
    return result;
  }

  async removeProject(projectId: string) {
    this.projectState.delete(projectId);
    return this.db.files.where({ projectId }).delete();
  }

  isProjectReady(projectId: string) {
    return this.projectState.get(projectId) === this.PROJECT_STATE.READY;
  }

  isFileParsed(projectId: string, id: string) {
    return this.fileState.get(this.lgFileId(projectId, id)) === this.FILE_STATE.PARSED;
  }

  isFileParsing(projectId: string, id: string) {
    return this.fileState.get(this.lgFileId(projectId, id)) === this.FILE_STATE.PARSING;
  }

  private lgFileId = (projectId: string, id: string) => `${projectId}.${id}`;
}

// cache the lg parse result. For updateTemplate function,
// if we use the cache, the 12k lines file will reduce the parse time(10s -> 150ms)
export const cache = new LgCache();

const filterParseResult = (lgFile: LgFileOriginal) => {
  if (!lgFile) {
    return;
  }

  const cloned = { ...lgFile };
  // remove the parse tree from the result.
  // The parse tree has Int32Array type, can't be frozen by recoil
  delete cloned.parseResult;
  return cloned;
};

const emptyLgFile = (projectId, id: string, content: string): LgFile => {
  return {
    id,
    projectId,
    content,
    diagnostics: [],
    templates: [],
    allTemplates: [],
    imports: [],
    isContentUnparsed: true,
  };
};

async function waitUntil(cb: () => boolean | Promise<boolean>, timeout: number = 10000, interval: number = 100) {
  return new Promise((resolve) => {
    const inter = setInterval(async () => {
      if (await cb()) {
        clearInterval(inter);
        resolve();
      }
    }, interval);
    setTimeout(() => clearInterval(inter), timeout);
  });
}

export const handleMessage = async (msg: LgMessageEvent) => {
  let payload: any = null;
  switch (msg.type) {
    case LgActionType.Get: {
      const { projectId, id } = msg.payload;

      if (!cache.isProjectReady(projectId)) {
        await waitUntil(() => cache.isProjectReady(projectId));
      }

      const lgFile = await cache.get(projectId, id);
      payload = filterParseResult(lgFile);
      break;
    }

    case LgActionType.NewCache: {
      // const { projectId } = msg.payload;
      // cache.addProject(projectId);
      await cache.db.files.clear();
      break;
    }

    case LgActionType.CleanCache: {
      const { projectId } = msg.payload;
      await cache.removeProject(projectId);
      break;
    }

    case LgActionType.Parse: {
      const { id, content, lgFiles, projectId } = msg.payload;

      if (!cache.isProjectReady(projectId)) {
        await waitUntil(() => cache.isProjectReady(projectId));
      }

      if (cache.isFileParsing(projectId, id)) {
        await waitUntil(() => cache.isFileParsed(projectId, id));
      }

      const lgFile = lgUtil.parse(id, content, lgFiles);
      await cache.set(projectId, lgFile);
      payload = filterParseResult(lgFile);
      break;
    }

    case LgActionType.ParseAll: {
      const { lgResources, projectId } = msg.payload;
      // We'll do the parsing when the file is required. Save empty LG instead.
      payload = await cache.setProject(projectId, lgResources as any);
      break;
    }

    case LgActionType.AddTemplate: {
      const { lgFile, template, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.addTemplate(targetFile, template, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.AddTemplates: {
      const { lgFile, templates, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.addTemplates(targetFile, templates, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.UpdateTemplate: {
      const { lgFile, templateName, template, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.updateTemplate(targetFile, templateName, template, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveTemplate: {
      const { lgFile, templateName, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.removeTemplate(targetFile, templateName, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveAllTemplates: {
      const { lgFile, templateNames, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.removeTemplates(targetFile, templateNames, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.CopyTemplate: {
      const { lgFile, toTemplateName, fromTemplateName, lgFiles, projectId } = msg.payload;
      const targetFile = await cache.get(projectId, lgFile.id);
      const result = lgUtil.copyTemplate(targetFile, fromTemplateName, toTemplateName, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }
  }
  return payload;
};

ctx.onmessage = async function (event) {
  const msg = event.data as LgMessageEvent;

  try {
    const payload = await handleMessage(msg);

    ctx.postMessage({ id: msg.id, payload });
  } catch (error) {
    ctx.postMessage({ id: msg.id, error: error.message });
  }
};
