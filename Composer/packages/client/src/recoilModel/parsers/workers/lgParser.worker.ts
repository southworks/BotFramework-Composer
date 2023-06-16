// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { lgUtil } from '@bfc/indexers';
import { lgImportResolverGenerator, LgFile } from '@bfc/shared';

import { decycle, retrocycle } from '../../utils/jsonDecycleUtil';
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
import { IndexedDBCache, Project } from '../../persistence/indexerDBcache';

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

export class LgCache {
  // use projectId to support multiple bots.
  projects: Map<string, LgResources> = new Map();

  public db: IndexedDBCache;

  constructor() {
    this.db = new IndexedDBCache();
  }

  //public set(projectId: string, value: LgFile) {
  async set(projectId: string, value: LgFile) {
    console.log('parserWorker-set: get');
    const project = await this.db.projects.get(projectId);
    const lgResources = project.lgResources;

    //if (!lgResources) return;
    console.log('parserWorker-set: lgResources.set');
    lgResources.set(value.id, value);

    // update reference resource
    const updatedResource = value.parseResult;
    lgResources.forEach((lgResource) => {
      if (lgResource.parseResult) {
        //lgResource.parseResult = '';
        if (!lgResource.parseResult.references) {
          //const parsedRes = JSON.parse(lgResource.parseResult);
          //lgResource.parseResult = parsedRes;
        }
        lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
          return ref.id === value.id ? updatedResource : ref;
        });
        //const stringResult = this.stringifyResults(lgResource.parseResult);
        //const stringResult = JSON.stringify(lgResource.parseResult, decycle());
        const stringResult = JSON.parse(JSON.stringify(decycle(lgResource.parseResult, undefined)));
        lgResource.parseResult = stringResult;
        console.log('parserResult stringified');
      }
    });

    //this.projects.set(projectId, lgResources);
    console.log('parserWorker-set: put');
    const result = await this.db.projects.put(lgResources, projectId);
    console.log('parserWorker-set: done with put: ' + result);
  }

  // private stringifyResults(obj) {
  //   console.log('entered stringifyResults');
  //   let cache: object[] = [];
  //   const str = JSON.stringify(obj, (key, value) => {
  //     if (typeof value === 'object' && value !== null) {
  //       if (cache.indexOf(value) !== -1) {
  //         // Circular reference found, discard key
  //         return;
  //         //value = null;
  //       }
  //       // Store value in our collection
  //       cache.push(value);
  //     }
  //     return value;
  //   });
  //   cache = []; // reset the cache
  //   console.log('exited stringifyResults');
  //   return JSON.parse(str);
  // }

  // private updateResourceReference(resources: LgResources, value: LgFile) {
  //   resources.set(value.id, value);

  //   // update reference resource
  //   const updatedResource = value.parseResult;
  //   resources.forEach((lgResource) => {
  //     if (lgResource.parseResult) {
  //       lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
  //         return ref.id === value.id ? updatedResource : ref;
  //       });
  //     }
  //   });

  //   return resources;
  // }

  // public get(projectId: string, fileId: string) {
  //   console.log('lgCache-get fileId: ' + fileId);
  //   const file = this.projects.get(projectId)?.get(fileId);
  //   console.log('lgCache-get: file.id: ' + file?.id + ' file: ' + file);
  //   return file;
  // }

  async get(projectId: string, fileId?: string) {
    const project = await this.db.projects.get(projectId);
    if (!fileId) {
      //return project;
      return Array.from(project, ([name, value]) => value);
    }
    for (const [key, value] of project.entries()) {
      if (key === fileId) {
        return value;
      }
    }
  }

  async getMany(projectId: string, filter?: (obj: any) => boolean) {
    const result = await this.db.projects
      .filter((val) => (val.id === projectId && filter ? filter(val) : true))
      .toArray();
    if (result.length === null) {
      return Array.from(result, ([name, value]) => value);
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

const getTargetFile = async (projectId: string, lgFile: LgFile, lgFiles: LgFile[]) => {
  //console.log('getTargetFile');
  const cachedFile = await cache.get(projectId, lgFile.id);

  if (cachedFile?.isContentUnparsed) {
    //console.log('isContentUnparsed');
    //parse content, set and return
    const lgFile = lgUtil.parse(cachedFile.id, cachedFile.content, lgFiles);
    lgFile.isContentUnparsed = false;
    //console.log('going to set file: ' + lgFile.id + lgFile.isContentUnparsed);
    cache.set(projectId, lgFile);
    //return filterParseResult(lgFile);
    return lgFile;
  }
  const retroLgFile = retrocycle(cachedFile.parseResult);
  cachedFile.parseResult = retroLgFile;
  //cachedFile.parseResult = retroLgFile;
  // const updatedResource = cachedFile.parseResult;
  // lgFiles.forEach((lgResource) => {
  //   if (lgResource.parseResult) {
  //     lgResource.parseResult.references = lgResource.parseResult.references.map((ref) => {
  //       return ref.id === retroLgFile.id ? updatedResource : ref;
  //     });
  //   }
  // });

  // Instead of compare content, just use cachedFile as single truth of fact, because all updates are supposed to be happen in worker, and worker will always update cache.
  //return cachedFile ?? lgFile;
  return cachedFile ?? lgFile;
};

const emptyLgFile = (id: string, content: string): LgFile => {
  return {
    id,
    content,
    diagnostics: [],
    templates: [],
    allTemplates: [],
    imports: [],
    isContentUnparsed: true,
  };
};

export const handleMessage = async (msg: LgMessageEvent) => {
  console.log('handle Message: ' + msg.type);
  let payload: any = null;
  switch (msg.type) {
    case LgActionType.Get: {
      const { projectId, id } = msg.payload;
      let lgFile = await cache.get(projectId, id);
      if (!lgFile) {
        return;
      }
      if (lgFile.length > 1) {
        return lgFile;
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

      const lgFile = lgUtil.parse(id, content, lgFiles);
      await cache.set(projectId, lgFile);
      payload = filterParseResult(lgFile);
      break;
    }

    case LgActionType.ParseAll: {
      const { lgResources, projectId } = msg.payload;

      const payload: LgFile[] = [];
      //payload = await Promise.all(
      for (const lgResource of lgResources) {
        //lgResources.map(async ({ id, content }) => {
        //payload = lgResources.map((txtFile) => {
        //const lgFile = lgUtil.parse(id, content, lgResources);
        //cache.set(projectId, lgFile);
        const emptyLg = emptyLgFile(lgResource.id, lgResource.content);
        //const key = projectId.concat('-', emptyLg.id);
        //console.log('parseAll-set: ' + emptyLg.id);
        await cache.set(projectId, emptyLg);
        //console.log('parseAll-set-done: ' + emptyLg.id);
        //return filterParseResult(lgFile);
        payload.push(filterParseResult(emptyLg));
      }
      //);

      break;
    }

    case LgActionType.AddTemplate: {
      const { lgFile, template, lgFiles, projectId } = msg.payload;
      const target = await getTargetFile(projectId, lgFile, lgFiles);
      const result = lgUtil.addTemplate(target, template, lgFileResolver(lgFiles));
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.AddTemplates: {
      const { lgFile, templates, lgFiles, projectId } = msg.payload;
      const result = lgUtil.addTemplates(
        await getTargetFile(projectId, lgFile, lgFiles),
        templates,
        lgFileResolver(lgFiles)
      );
      await cache.set(projectId, result);
      payload = filterParseResult(result);
      break;
    }

    case LgActionType.UpdateTemplate: {
      const { lgFile, templateName, template, lgFiles, projectId } = msg.payload;
      const result = lgUtil.updateTemplate(
        await getTargetFile(projectId, lgFile, lgFiles),
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
        await getTargetFile(projectId, lgFile, lgFiles),
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
        await getTargetFile(projectId, lgFile, lgFiles),
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
        await getTargetFile(projectId, lgFile, lgFiles),
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
