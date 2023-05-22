// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import Dexie, { Table } from 'dexie';
import { lgUtil } from '@bfc/indexers';
import { lgImportResolverGenerator, LgFile, TextFile } from '@bfc/shared';
import axios from 'axios';
import ParseAllWorker from './lgParserAll.worker.ts';
import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';

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

const lgFileResolver = (lgFiles) => {
  return lgImportResolverGenerator(lgFiles, '.lg');
};

class LgCacheDatabase extends Dexie {
  public projects!: Table<any, string>;

  public constructor() {
    super('LgCacheDatabase');
    this.version(1).stores({ projects: '' });
  }
}

export class LgCache {
  public db: LgCacheDatabase;

  constructor() {
    this.db = new LgCacheDatabase();
  }

  async set(projectId: string, value: LgFile | LgFile[]) {
    let lgResources = await this.db.projects.get(projectId);

    if (!lgResources) return;

    if (Array.isArray(value)) {
      value.forEach((val) => this.updateResourceReference(lgResources, val));
    } else {
      this.updateResourceReference(lgResources, value);
    }

    return this.db.projects.put(lgResources, projectId);
  }

  async getOne(projectId: string, fileId: string) {
    const project = await this.db.projects.get(projectId);
    return project?.[fileId];
  }

  async getMany(projectId: string, filter?: (obj: any) => boolean) {
    const result = await this.db.projects.filter((val) => (val.id === projectId && filter ? filter(val) : true)).toArray();
    if(result.length === null) {
      return Array.from(result, ([name, value]) => (value))
    }
    return result;
  }

  async removeProject(projectId: string) {
    return this.db.projects.delete(projectId);
  }

  async addProject(projectId: string) {
    const project = await this.db.projects.get(projectId);
    if (!project) {
      await this.db.projects.add(new Map(), projectId);
    }
  }

  private updateResourceReference(resources: LgResources, value: LgFile) {
    resources.set(value.id, value);

    // update reference resource
    const updatedResource = value.parseResult;
    resources.forEach((lgResource) => {
      if (lgResource.parseResult) {
        lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
          return ref.id === value.id ? updatedResource : ref;
        });
      }
    });

    return resources;
  }
}

// cache the lg parse result. For updateTemplate function,
// if we use the cache, the 12k lines file will reduce the parse time(10s -> 150ms)
export const cache = new LgCache();

const filterParseResult = (lgFile: LgFile) => {
  const cloned = { ...lgFile };
  // remove the parse tree from the result.
  // The parse tree has Int32Array type, can't be frozen by recoil
  delete cloned.parseResult;
  return cloned;
};

const getTargetFile = async (projectId: string, lgFile: LgFile) => {
  const cachedFile = await cache.getOne(projectId, lgFile.id);

  // Instead of compare content, just use cachedFile as single truth of fact, because all updates are supposed to be happen in worker, and worker will always update cache.
  return cachedFile ?? lgFile;
};

export const handleMessage = async (msg: LgMessageEvent) => {
  let payload: any = null;
  switch (msg.type) {
    case LgActionType.Get: {
      const { projectId, id } = msg.payload;
      let lgFile = await cache.getOne(projectId, id);

      if (!lgFile) {
        return;
      }

      if (lgFile.isContentUnparsed !== false) {
        const lgFiles = await cache.getMany(projectId);
        lgFile = lgUtil.parse(lgFile.id, lgFile.content, lgFiles);
        await cache.set(projectId, lgFile);
      }

      return lgFile;
    }

    case LgActionType.NewCache: {
      const { projectId } = msg.payload;
      await cache.addProject(projectId);
      break;
    }

    case LgActionType.CleanCache: {
      const { projectId } = msg.payload;
      await cache.removeProject(projectId);
      break;
    }

    case LgActionType.Parse: {
      const { id, content, lgFiles, projectId } = msg.payload;

      const lgResources = lgFiles?.length ? lgFiles : await cache.getMany(projectId);
      const lgFile = lgUtil.parse(id, content, lgResources);
      await cache.set(projectId, lgFile);
      payload = filterParseResult(lgFile);
      break;
    }

    case LgActionType.ParseAll: {
      // await cache.set(msg.payload.projectId, msg.payload.lgResources);
      // const s = msg.payload.lgResources[0];
      // const lgFile = lgUtil.parse(s.id, s.content, msg.payload.lgResources);
      // return [lgFile];
      const { lgResources, projectId } = msg.payload;

      payload = lgResources.map(({ id, content }) => {
        const lgFile = lgUtil.parse(id, content, lgResources);
        cache.set(projectId, lgFile);
        return filterParseResult(lgFile);
      });
      // const { lgResources, projectId } = msg.payload;

      // payload = msg.payload.lgResources;

      // const parsed: LgFile[] = []
      // for (const r of lgResources) {
      //   const i = r.id.lastIndexOf('.');
      //   const name = r.id.slice(0, i);
      //   if(!parsed.some(e => e.id.startsWith(name))){
      //     const lgFile = lgUtil.parse(r.id, r.content, lgResources);
      //     parsed.push(filterParseResult(lgFile));
      //   }
      // }

      // payload = parsed;
      // const size = new TextEncoder().encode(JSON.stringify(parsed)).length
      // const kiloBytes = size / 1024;
      // const megaBytes = kiloBytes / 1024;
      // console.log({ KB: kiloBytes, MB: megaBytes });

      // const worker = new ParseAllWorker();

      // const promises = lgResources.map(async (lgResource) =>
      //   axios
      //     .post<LgFile>(`/api/projects/${projectId}/parse/lg-file`, { lgResource, lgResources })
      //     .then(({ data }) => {
      //       // cache.set(projectId, data);
      //       return data
      //     })
      // );

      // const lgFiles = flatten(await Promise.all(promises)).map((lgFile) => filterParseResult(lgFile));
      // payload = lgFiles.map((e) => e.id);
      // payload = lgFiles;

      // const chunkSize = lgResources.length >= 5 ? lgResources.length / 5 : lgResources.length;
      // const chunks = chunk(lgResources, chunkSize);

      // const promises = chunks.map((resource) => {
      //   const worker = new ParseAllWorker();
      //   worker.postMessage(resource);
      //   return new Promise<LgFile[]>((res) => {
      //     worker.onmessage = (data) => res(data as any);
      //   });
      // });

      // const lgFiles = await Promise.all(
      //   lgResources.map(async ({ id, content }) => {
      //     return new Promise<LgFile>((res, rej) => {
      //       try {
      //         console.log({ id, content });
      //         const value = lgUtil.parse(id, content, lgResources);
      //         res(value);
      //       } catch (error) {
      //         rej(error)              ;
      //       }
      //     })
      //   })
      // );

      break;
    }

    case LgActionType.AddTemplate: {
      const { lgFile, template, lgFiles, projectId } = msg.payload;
      const result = lgUtil.addTemplate(await getTargetFile(projectId, lgFile), template, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.AddTemplates: {
      const { lgFile, templates, lgFiles, projectId } = msg.payload;
      const result = lgUtil.addTemplates(await getTargetFile(projectId, lgFile), templates, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.UpdateTemplate: {
      const { lgFile, templateName, template, lgFiles, projectId } = msg.payload;
      const result = lgUtil.updateTemplate(
        await getTargetFile(projectId, lgFile),
        templateName,
        template,
        lgFileResolver(lgFiles)
      );
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveTemplate: {
      const { lgFile, templateName, lgFiles, projectId } = msg.payload;
      const result = lgUtil.removeTemplate(
        await getTargetFile(projectId, lgFile),
        templateName,
        lgFileResolver(lgFiles)
      );
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.RemoveAllTemplates: {
      const { lgFile, templateNames, lgFiles, projectId } = msg.payload;
      const result = lgUtil.removeTemplates(
        await getTargetFile(projectId, lgFile),
        templateNames,
        lgFileResolver(lgFiles)
      );
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.CopyTemplate: {
      const { lgFile, toTemplateName, fromTemplateName, lgFiles, projectId } = msg.payload;
      const result = lgUtil.copyTemplate(
        await getTargetFile(projectId, lgFile),
        fromTemplateName,
        toTemplateName,
        lgFileResolver(lgFiles)
      );
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
