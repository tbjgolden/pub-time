```sh
git clone https://github.com/tbjgolden/pub-time.git cool-package-name
cd cool-package-name
npm install
# One time init function to convert template to new project
npx xnr .scripts/name.ts
```

---

# pub-time

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/pub-time)
![install size](https://img.shields.io/bundlephobia/min/pub-time)
![coverage](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftbjgolden%2Fpub-time%2Fmain%2Fcoverage.json&label=coverage&query=$.total.lines.pct&color=brightgreen&suffix=%25)
![npm type definitions](https://img.shields.io/npm/types/pub-time)
![license](https://img.shields.io/npm/l/pub-time)

A npm library that does exactly what it says on the tin.

## Table of Contents

## Background

- Cover motivation.
- Cover abstract dependencies.
- Cover compatible versions of Node, npm and ECMAScript.
- Cover similar packages and alternatives.

## Install

This package is available from the `npm` registry.

```sh
npm install pub-time
```

## Usage

```sh
npx pub-time ...
```

Supports JavaScript + TypeScript:

```ts
import { foo } from "pub-time";

foo();
```

Can also be imported via `require("pub-time")`.

## API

...

## Credits

...

## Contributing

- State where users can ask questions.
- State whether PRs are accepted.
- List any requirements for contributing; for instance, having a sign-off on commits.

Dev environment requires:

- node >= 16.14.0
- npm >= 6.8.0
- git >= 2.11

## Licence

Apache-2.0
