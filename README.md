[![npm version](https://badge.fury.io/js/write-vscodestat.svg)](https://badge.fury.io/js/write-vscodestat)
[![CI](https://github.com/veghdev/write-vscodestat/workflows/CI/badge.svg?branch=main)](https://github.com/veghdev/write-vscodestat/actions/workflows/ci.yml)


# About The Project

write-vscodestat makes it easy to collect, filter and save vscode statistics to csv files.

# Installation

write-vscodestat requires `enum`, `csv-writer`, `csv-parser` and `vsce` packages.

```sh
npm install write-vscodestat
```

# Usage

```js
const WriteVscodeStat = require("write-vscodestat").default;

const targetPackage = "gitlens";
const csvDir = "stats/gitlens";
const writevscodestat = new WriteVscodeStat(targetPackage, csvDir);

writevscodestat.datePeriod = "month";
writevscodestat.writeVscodeStat();
```

Visit our [documentation](https://veghdev.github.io/write-vscodestat/) site for code reference or 
our [wiki](https://github.com/veghdev/write-vscodestat/wiki/) site for a step-by-step tutorial into write-vscodestat.

# Contributing

We welcome contributions to the project, visit our [contributing](https://github.com/veghdev/write-vscodestat/blob/main/CONTRIBUTING.md) guide for further info.

# Contact

Join our [discussions](https://github.com/veghdev/write-vscodestat/discussions) page if you have any questions or comments.

# License

Copyright © 2022.

Released under the [Apache 2.0 License](https://github.com/veghdev/write-vscodestat/blob/main/LICENSE).