/**
 * 宿主环境能力检测与统一适配层 (支持静态条件编译与摇树优化)
 */

// 1. 声明编译期注入的魔术变量 (通过 @rollup/plugin-replace 在构建时注入)
declare const __ENV_IS_NODE__: boolean;
declare const __ENV_IS_BROWSER__: boolean;
declare const __ENV_IS_JXA__: boolean;
declare const __ENV_IS_CSCRIPT__: boolean;

// 2. 补全特定环境全局变量声明
declare var process: any;
declare var ActiveXObject: any;
declare var ObjC: any;
declare var Application: any;
declare var $: any;
declare var Ref: any;

// 3. 环境标识：优先读取编译期注入，无注入时安全回退至运行时动态判定 (兼顾 direct ts-node 运行)
export const isNode = typeof __ENV_IS_NODE__ !== 'undefined'
  ? __ENV_IS_NODE__
  : (typeof process !== 'undefined' && Boolean(process && process.versions && process.versions.node));

export const isBrowser = typeof __ENV_IS_BROWSER__ !== 'undefined'
  ? __ENV_IS_BROWSER__
  : (typeof window !== 'undefined' && typeof window.document !== 'undefined');

export const isJXA = typeof __ENV_IS_JXA__ !== 'undefined'
  ? __ENV_IS_JXA__
  : (!isNode && !isBrowser && typeof ObjC !== 'undefined' && typeof Application !== 'undefined');

export const isCScript = typeof __ENV_IS_CSCRIPT__ !== 'undefined'
  ? __ENV_IS_CSCRIPT__
  : (!isNode && !isBrowser && !isJXA && typeof ActiveXObject !== 'undefined');

/**
 * Node.js 动态 require 获取
 */
function getNativeRequire(): any {
  if (!isNode) return null;
  try {
    return typeof require !== 'undefined' ? require : null;
  } catch (e) {
    return null;
  }
}

/**
 * CScript 专属：借用 htmlfile (IE9+ 模式) 的 JSON 引擎
 */
function getCScriptJsonEngine(): any {
  try {
    var htmlFile = new ActiveXObject('htmlfile');
    htmlFile.open();
    htmlFile.write('<meta http-equiv="x-ua-compatible" content="IE=9" />');
    htmlFile.close();
    if (htmlFile.parentWindow && htmlFile.parentWindow.JSON) {
      return htmlFile.parentWindow.JSON;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

var cscriptJsonCache: any = null;

// ============================================================================
// 1. JSON 解析适配 (Parse)
// ============================================================================
export function nativeJsonParse(jsonStr: string): any {
  if (isNode && typeof JSON !== 'undefined' && JSON.parse) {
    return JSON.parse(jsonStr);
  }

  if (isBrowser && typeof JSON !== 'undefined' && JSON.parse) {
    return JSON.parse(jsonStr);
  }

  if (isJXA && typeof JSON !== 'undefined' && JSON.parse) {
    return JSON.parse(jsonStr);
  }

  if (isCScript) {
    if (!cscriptJsonCache) {
      cscriptJsonCache = getCScriptJsonEngine();
    }
    if (cscriptJsonCache && cscriptJsonCache.parse) {
      return cscriptJsonCache.parse(jsonStr);
    }
    try {
      return eval('(' + jsonStr + ')');
    } catch (e) {
      return null;
    }
  }

  return null;
}

// ============================================================================
// 2. JSON 序列化适配 (Stringify)
// ============================================================================
export function nativeJsonStringify(obj: any): string {
  if (isNode && typeof JSON !== 'undefined' && JSON.stringify) {
    return JSON.stringify(obj);
  }

  if (isBrowser && typeof JSON !== 'undefined' && JSON.stringify) {
    return JSON.stringify(obj);
  }

  if (isJXA && typeof JSON !== 'undefined' && JSON.stringify) {
    return JSON.stringify(obj);
  }

  if (isCScript) {
    if (!cscriptJsonCache) {
      cscriptJsonCache = getCScriptJsonEngine();
    }
    if (cscriptJsonCache && cscriptJsonCache.stringify) {
      return cscriptJsonCache.stringify(obj);
    }
    return fallbackStringify(obj);
  }

  return fallbackStringify(obj);
}

function fallbackStringify(obj: any): string {
  try {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (typeof obj === 'string') return '"' + obj.replace(/"/g, '\\"') + '"';

    if (obj instanceof Array) {
      var arrRes: string[] = [];
      for (var i = 0; i < obj.length; i++) {
        arrRes.push(fallbackStringify(obj[i]));
      }
      return '[' + arrRes.join(',') + ']';
    }

    var objRes: string[] = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        objRes.push('"' + key + '":' + fallbackStringify(obj[key]));
      }
    }
    return '{' + objRes.join(',') + '}';
  } catch (e) {
    return '';
  }
}

// ============================================================================
// 3. HTTP 同步请求适配 (Sync POST)
// ============================================================================
export function httpPostSync(url: string, headers: Record<string, string>, body: string): string {
  if (isNode) {
    var req = getNativeRequire();
    if (req) {
      try {
        var SyncXHR = req('xmlhttprequest').XMLHttpRequest;
        var nodeXhr = new SyncXHR();
        nodeXhr.open('POST', url, false);
        setXhrHeaders(nodeXhr, headers);
        nodeXhr.send(body);
        return nodeXhr.responseText || '';
      } catch (e) {
        // ignore
      }
    }
    return '';
  }

  if (isBrowser && typeof XMLHttpRequest !== 'undefined') {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, false);
      setXhrHeaders(xhr, headers);
      xhr.send(body);
      return xhr.responseText || '';
    } catch (e) {
      return '';
    }
  }

  if (isJXA) {
    try {
      ObjC.import('Foundation');
      var reqUrl = $.NSURL.URLWithString(url);
      var nsReq = $.NSMutableURLRequest.requestWithURL(reqUrl);
      nsReq.setHTTPMethod('POST');

      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k)) {
          nsReq.setValueForHTTPHeaderField(headers[k], k);
        }
      }

      var nsData = $(body).dataUsingEncoding($.NSUTF8StringEncoding);
      nsReq.setHTTPBody(nsData);

      var response = Ref();
      var error = Ref();
      var data = $.NSURLConnection.sendSynchronousRequestReturningResponseError(nsReq, response, error);

      if (!data.isNil()) {
        var resStr = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
        return resStr.js;
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  if (isCScript) {
    try {
      var http = new ActiveXObject('MSXML2.ServerXMLHTTP.6.0');
      http.open('POST', url, false);
      setXhrHeaders(http, headers);
      http.send(body);
      return http.responseText || '';
    } catch (e) {
      return '';
    }
  }

  return '';
}

function setXhrHeaders(httpObj: any, headers: Record<string, string>): void {
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k)) {
      httpObj.setRequestHeader(k, headers[k]);
    }
  }
}

// ============================================================================
// 4. 文本文件读取适配 (Read Text File Sync)
// ============================================================================
export function readTextFileSync(filePath: string, encoding = 'utf-8'): string {
  if (isNode) {
    try {
      var req = getNativeRequire();
      if (req) {
        var fs = req('fs');
        return fs.readFileSync(filePath, encoding);
      }
    } catch (e) {
      return '';
    }
  }

  if (isBrowser) {
    return '';
  }

  if (isJXA) {
    try {
      ObjC.import('Foundation');
      var nsStr = $.NSString.stringWithContentsOfFileEncodingError(
        filePath,
        $.NSUTF8StringEncoding,
        null
      );
      return nsStr ? nsStr.js : '';
    } catch (e) {
      return '';
    }
  }

  if (isCScript) {
    try {
      var stream = new ActiveXObject('ADODB.Stream');
      stream.Type = 2; // Text
      stream.Charset = encoding;
      stream.Open();
      stream.LoadFromFile(filePath);
      var text = stream.ReadText();
      stream.Close();
      return text;
    } catch (e) {
      return '';
    }
  }

  return '';
}