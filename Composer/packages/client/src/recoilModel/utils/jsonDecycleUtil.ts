// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function decycle(object: any, replacer: any) {
  // Make a deep copy of an object or array, assuring that there is at most
  // one instance of each object or array in the resulting structure. The
  // duplicate references (which might be forming cycles) are replaced with
  // an object of the form

  //      {"$ref": PATH}

  // where the PATH is a JSONPath string that locates the first occurance.

  // So,

  //      var a = [];
  //      a[0] = a;
  //      return JSON.stringify(JSON.decycle(a));

  // produces the string '[{"$ref":"$"}]'.

  // If a replacer function is provided, then it will be called for each value.
  // A replacer function receives a value and returns a replacement value.

  // JSONPath is used to locate the unique object. $ indicates the top level of
  // the object or array. [NUMBER] or [STRING] indicates a child element or
  // property.

  const objects = new WeakMap(); // object to path mappings

  return (function derez(value, path) {
    // The derez function recurses through the object, producing the deep copy.

    let oldPath; // The path of an earlier occurance of value
    let nu; // The new object or array

    // If a replacer function was provided, then call it to get a replacement value.

    if (replacer !== undefined) {
      value = replacer(value);
    }

    // typeof null === "object", so go on if this value is really an object but not
    // one of the weird builtin objects.
    if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof Boolean) &&
      !(value instanceof Date) &&
      !(value instanceof Number) &&
      !(value instanceof RegExp) &&
      !(value instanceof String)
    ) {
      // If the value is an object or array, look to see if we have already
      // encountered it. If so, return a {"$ref":PATH} object. This uses an
      // ES6 WeakMap.

      oldPath = objects.get(value);
      if (oldPath !== undefined) {
        return { $ref: oldPath };
      }

      // Otherwise, accumulate the unique value and its path.
      objects.set(value, path);

      // If it is an array, replicate the array.
      if (Array.isArray(value)) {
        nu = [];
        value.forEach((element, i) => {
          nu[i] = derez(element, path + '[' + i + ']');
        });
      } else {
        // If it is an object, replicate the object.
        nu = {};
        Object.keys(value).forEach((name) => {
          nu[name] = derez(value[name], path + '[' + JSON.stringify(name) + ']');
        });
      }
      return nu;
    }
    return value;
  })(object, '$');
}

export function retrocycle($) {
  // Restore an object that was reduced by decycle. Members whose values are
  // objects of the form
  //      {$ref: PATH}
  // are replaced with references to the value found by the PATH. This will
  // restore cycles. The object will be mutated.

  // The eval function is used to locate the values described by a PATH. The
  // root object is kept in a $ variable. A regular expression is used to
  // assure that the PATH is extremely well formed. The regexp contains nested
  // * quantifiers. That has been known to have extremely bad performance
  // problems on some browsers for very long strings. A PATH is expected to be
  // reasonably short. A PATH is allowed to belong to a very restricted subset of
  // Goessner's JSONPath.

  // So,
  //      var s = '[{"$ref":"$"}]';
  //      return JSON.retrocycle(JSON.parse(s));
  // produces an array containing a single element which is the array itself.

  // eslint-disable-next-line security/detect-unsafe-regex, no-control-regex
  const px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\(?:[\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

  (function rez(value) {
    // The rez function walks recursively through the object looking for $ref
    // properties. When it finds one that has a value that is a path, then it
    // replaces the $ref object with a reference to the value that is found by
    // the path.

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((element, i) => {
          if (typeof element === 'object' && element !== null) {
            const path = element.$ref;
            if (typeof path === 'string' && px.test(path)) {
              value[i] = eval(path);
            } else {
              rez(element);
            }
          }
        });
      } else {
        Object.keys(value).forEach((name) => {
          const item = value[name];
          if (typeof item === 'object' && item !== null) {
            const path = item.$ref;
            if (typeof path === 'string' && px.test(path)) {
              value[name] = eval(path);
            } else {
              rez(item);
            }
          }
        });
      }
    }
  })($);
  return $;
}

function isObject(objValue) {
  return (
    objValue &&
    typeof objValue === 'object' &&
    objValue.constructor.prototype instanceof Object &&
    !Array.isArray(objValue)
  );
}

export function jsonParse(obj, structure: Map<string, object>) {
  //const structure = new Map<string, object>();
  const process = (obj) => {
    const result: any = {};
    if (isObject(obj)) {
      result.className = obj.constructor.name;
    }
    const methods = Object.getPrototypeOf(obj);
    const props = Object.getOwnPropertyNames(obj);
    structure.set(obj.constructor.name, methods);
    for (const propName of props) {
      const prop = obj[propName];
      if (typeof prop !== 'object') {
        result[propName] = prop;
      } else if (Array.isArray(prop)) {
        result[propName] = prop.map(process);
      } else {
        if (structure.has(prop.constructor.name)) {
          //no-op
        } else {
          const methods = Object.getPrototypeOf(prop);
          structure.set(prop.constructor.name, methods);
          result[propName] = process(prop);
        }
      }
    }
    return result;
  };
  return process(obj);
}

export function jsonRevive(obj, structure: Map<string, object>) {
  const { __className__, ...rest } = obj;
  let result = {};
  //const structure = new Map<string, object>();
  if (structure.has(__className__)) {
    const methods = structure.get(__className__) ?? null;
    result = Object.create(methods);
  }

  const props = Object.getOwnPropertyNames(rest);
  for (const propName of props) {
    const prop = obj[propName];
    if (isObject(prop)) {
      result[propName] = jsonRevive(prop, structure);
    } else if (Array.isArray(prop)) {
      result[propName] = prop.map((prop) => jsonRevive(prop, structure));
    } else {
      result[propName] = prop;
    }
  }
  return result;
}
