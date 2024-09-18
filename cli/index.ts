#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from "commander";
import { publish } from "../lib/index";

const program = new Command();

program
  .option("--dry-run", "Perform a dry run without making any changes")
  .option("--force-version <version>", "Override the autocalculated version")
  .option("--prev-hash <hash>", "Specify the previous hash");

program.parse(process.argv);

const options = program.opts<{ dryRun?: boolean; forceVersion?: string; prevHash?: string }>();

publish(options).then((didPublish) => {
  console.log();
  if (didPublish) {
    console.log("published");
  } else {
    console.log("did not publish");
  }
});
