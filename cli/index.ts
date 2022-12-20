#!/usr/bin/env node
/* eslint-disable no-console */

import { publish } from "../lib/index";

const [_cmd, _fileName, ...args] = process.argv;

publish({
  prevHash: args.find((arg) => arg !== "--dry-run"),
  dryRun: args.includes("--dry-run"),
}).then((didPublish) => {
  console.log();
  if (didPublish) {
    console.log("published");
  } else {
    console.log("did not publish");
  }
});
