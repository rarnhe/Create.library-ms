mkdir ts-to-jscript && cd ts-to-jscript

..\node-v24.21.0-win-x64\npm init -y

cd ..

set PATH=%CD%\node-v24.21.0-win-x64;%PATH%

..\node-v24.21.0-win-x64\npm install --save-dev typescript iconv-lite @babel/core @babel/preset-env @babel/plugin-transform-property-literals @babel/plugin-transform-reserved-words rollup @rollup/plugin-typescript @rollup/plugin-babel @rollup/plugin-node-resolve @rollup/plugin-commonjs @rollup/plugin-replace core-js

npx rollup -c

cscript //nologo dist/output.js