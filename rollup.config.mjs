import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import fs from 'fs';
import iconv from 'iconv-lite';

// 动态获取构建目标，未指定时默认针对 'cscript' 优化
const targetEnv = process.env.BUILD_TARGET || 'cscript';

// 1. 自定义插件：将 JS 保留字点号属性转为方括号访问 (解决 JScript 缺少标识符报错)
function fixJScriptReservedWordsPlugin() {
  return {
    name: 'fix-jscript-reserved-words',
    renderChunk(code) {
      // 匹配 .return、.catch、.delete、.default 等保留字点号调用并替换为 ["xxx"]
      const fixedCode = code
        .replace(/\.return\b/g, '["return"]')
        .replace(/\.catch\b/g, '["catch"]')
        .replace(/\.delete\b/g, '["delete"]')
        .replace(/\.default\b/g, '["default"]')
        .replace(/\.class\b/g, '["class"]');
      return { code: fixedCode, map: null };
    }
  };
}

// 2. 转 GBK 编码插件
function convertToGbkPlugin() {
  return {
    name: 'convert-to-gbk',
    writeBundle(options) {
      const filePath = options.file;
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const gbkBuffer = iconv.encode(content, 'gbk');
        fs.writeFileSync(filePath, gbkBuffer);
      }
    }
  };
}

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/output.js',
    format: 'iife',
    name: 'JScriptApp',
    strict: false,
    banner: '/* JScript Compatible Script */\n',
    footer: '\n'
  },
  plugins: [
    // 关键点 1：编译期环境替换 (必须置于 Babel 之前)
    replace({
      preventAssignment: true,
      values: {
        '__ENV_IS_NODE__': JSON.stringify(targetEnv === 'node'),
        '__ENV_IS_BROWSER__': JSON.stringify(targetEnv === 'browser'),
        '__ENV_IS_JXA__': JSON.stringify(targetEnv === 'jxa'),
        '__ENV_IS_CSCRIPT__': JSON.stringify(targetEnv === 'cscript')
      }
    }),
    // 关键点 2：明确告知 node-resolve 在省略后缀时尝试补全 .ts 和 .js
    resolve({ 
      browser: false, 
      preferBuiltins: false,
      extensions: ['.ts', '.js'] 
    }),
    commonjs({ strictRequires: false }),
    // 关键点 3：配置 Babel 正确转译 .ts 文件
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts'],
      exclude: 'node_modules/**',
      presets: [
        ['@babel/preset-env', { targets: { ie: '8' } }],
        '@babel/preset-typescript'
      ]
    }),
    fixJScriptReservedWordsPlugin(), // 在打包完成前修复 JScript 保留字
    convertToGbkPlugin()
  ]
};