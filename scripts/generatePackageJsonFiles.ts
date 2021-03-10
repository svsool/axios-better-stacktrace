import path from 'path';
import fs from 'fs';

const libFolder = path.resolve(__dirname, '../lib');

fs.writeFileSync(
  path.resolve(libFolder, 'cjs', 'package.json'),
  `{
  "type": "commonjs"
}`,
);

fs.writeFileSync(
  path.resolve(libFolder, 'esm', 'package.json'),
  `{
  "type": "module"
}`,
);
