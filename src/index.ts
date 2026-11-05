import {
  isNode,
  isBrowser,
  isJXA,
  isCScript,
  nativeJsonParse,
  nativeJsonStringify,
  readTextFileSync
} from './env';

// 统一放置在文件顶层声明
declare var ObjC: any;
declare var $: any;
declare var ActiveXObject: any;
declare var WScript: any;

export interface VerifyResult {
  envName: string;
  jsonParseOk: boolean;
  jsonStringifyOk: boolean;
  fsReadOk: boolean;
  timestamp: number;
}

function getEnvName(): string {
  if (isNode) return 'Node.js Runtime';
  if (isBrowser) return 'Browser Environment';
  if (isJXA) return 'macOS JXA (JavaScript for Automation)';
  if (isCScript) return 'Windows WScript/CScript (JScript)';
  return 'Unknown Environment';
}

export function runSystemCheck(): VerifyResult {
  const envName = getEnvName();

  // 1. JSON 序列化与解析测试
  const testObj = { name: 'MultiEnvTest', value: 2026, active: true };
  const jsonStr = nativeJsonStringify(testObj);
  const parsed = nativeJsonParse(jsonStr);

  const jsonStringifyOk = Boolean(jsonStr && jsonStr.indexOf('MultiEnvTest') !== -1);
  const jsonParseOk = Boolean(parsed && Number(parsed.value) === 2026);

  // 2. 文件系统读写测试
  let fsReadOk = false;

  if (isNode) {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tempPath = path.join(os.tmpdir(), 'env_node_test.txt');
      fs.writeFileSync(tempPath, 'Node Test OK', 'utf-8');
      fsReadOk = readTextFileSync(tempPath, 'utf-8').indexOf('Node Test OK') !== -1;
      fs.unlinkSync(tempPath);
    } catch (e) {
      fsReadOk = false;
    }
  } else if (isJXA) {
    try {
      ObjC.import('Foundation');
      const tempPath = '/tmp/env_jxa_test.txt';
      const nsStr = $.NSString.stringWithString('JXA Test OK');
      nsStr.writeToFileAtomicallyEncodingError(tempPath, true, $.NSUTF8StringEncoding, null);
      fsReadOk = readTextFileSync(tempPath, 'utf-8').indexOf('JXA Test OK') !== -1;
    } catch (e) {
      fsReadOk = false;
    }
  } else if (isCScript) {
    try {
      const fso = new ActiveXObject('Scripting.FileSystemObject');
      const tempFile = fso.GetSpecialFolder(2) + '\\env_cscript_test.txt';
      const stream = fso.CreateTextFile(tempFile, true);
      stream.WriteLine('CScript Test OK');
      stream.Close();

      fsReadOk = readTextFileSync(tempFile, 'utf-8').indexOf('CScript Test OK') !== -1;
      fso.DeleteFile(tempFile);
    } catch (e) {
      fsReadOk = false;
    }
  } else if (isBrowser) {
    fsReadOk = false;
  }

  return {
    envName,
    jsonParseOk,
    jsonStringifyOk,
    fsReadOk,
    timestamp: new Date().getTime(),
  };
}

function printLog(msg: string): void {
  if (isNode || isBrowser || isJXA) {
    console.log(msg);
  } else if (isCScript) {
    WScript.Echo(msg);
  }
}

printLog('--------------------------------------------------');
printLog('[Cross-Platform Engine] 多宿主环境能力测试开始...');
printLog('--------------------------------------------------');

const result = runSystemCheck();

printLog('当前运行环境: ' + result.envName);
printLog('JSON 序列化测试: ' + (result.jsonStringifyOk ? '成功 [PASS]' : '失败 [FAIL]'));
printLog('JSON 解析测试:   ' + (result.jsonParseOk ? '成功 [PASS]' : '失败 [FAIL]'));
printLog('文件同步读取测试: ' + (result.fsReadOk ? '成功 [PASS]' : '失败 [FAIL/N/A]'));
printLog('时间戳记录:     ' + result.timestamp);
printLog('--------------------------------------------------');