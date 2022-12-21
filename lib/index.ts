import { generateRelease, generateChangelogMarkdown } from "./conventional";
import { run, read, write, remove, isFile, ask } from "./functions";
import { pkgJson } from "./pkgJson";
import { versionToHumanString, versionToSemverString } from "./version";
import { exec } from "node:child_process";
import { homedir } from "node:os";

export type Config = {
  /* custom log function instead of console.log */
  log: (message: string) => void;
  /* if true, package is not published, and changes are not pushed to remote (but are committed) */
  dryRun: boolean;
  /* if left undefined, will treat last 'v#.#.#' git tag as the last commit of the prev release
     if a string, will be treated as the hash of the last commit of the prev release
     to force include all commits, use the value 'all' */
  prevHash?: string;
  /* custom functions used in publish process */
  build: string | ((nextSemver: string) => Promise<void>);
  checkBuild: string | ((nextSemver: string) => Promise<void>);
  test: string | (() => Promise<void>);
  lint: string | (() => Promise<void>);
};

export const DEFAULT_CONFIG: Config = {
  // eslint-disable-next-line no-console
  log: console.log,
  prevHash: undefined,
  dryRun: false,
  lint: "lint",
  build: "build",
  checkBuild: "check-build",
  test: "test",
};

export const publish = async (config: Partial<Config>): Promise<boolean> => {
  const cfg: Config = { ...DEFAULT_CONFIG, ...config };

  if (cfg.dryRun) {
    cfg.log(
      "--dry-run:\n  - package will not be published\n  - local git changes will not pushed to remote\n"
    );
  }

  const build: Exclude<Config["build"], string> =
    typeof cfg.build === "string" ? runify(cfg.build, true, { stdio: "inherit" }) : cfg.build;
  const checkBuild: Exclude<Config["checkBuild"], string> =
    typeof cfg.checkBuild === "string"
      ? runify(cfg.checkBuild, false, { stdio: "inherit" })
      : cfg.checkBuild;
  const test: Exclude<Config["test"], string> =
    typeof cfg.test === "string" ? runify(cfg.test, true, { stdio: "inherit" }) : cfg.test;
  const lint: Exclude<Config["lint"], string> =
    typeof cfg.lint === "string" ? runify(cfg.lint, false, { stdio: "inherit" }) : cfg.lint;

  try {
    // preconditions
    if (!isFile("package.json")) {
      throw new Error("must be run from package root");
    }
    run("git fetch --all --prune");
    const statusStdout = run("git --no-optional-locks status --porcelain=2 --branch");
    if (!statusStdout.includes("\n# branch.upstream origin/main")) {
      throw new Error("can only release from main (with origin/main as upstream)");
    }
    if (statusStdout.split("\n").some((line) => Boolean(line) && !line.startsWith("# "))) {
      throw new Error("local has uncommitted files");
    }
    if (!statusStdout.includes("\n# branch.ab +0 -0")) {
      throw new Error("local is not level with remote");
    }
    // common errors
    const packageJson = pkgJson();
    if (packageJson.name === undefined) {
      throw new Error(`package.json should have a name`);
    }
    if (packageJson.files === undefined) {
      throw new Error(`package.json should include a files array`);
    }
    if (packageJson.license === undefined) {
      throw new Error(`package.json should have a license`);
    }
    if (!isFile("README.md") || read("README.md").length < 100) {
      throw new Error(`project should contain a README.md`);
    }
    if (packageJson.keywords === undefined || packageJson.keywords.length === 0) {
      throw new Error(`package.json should have some keywords`);
    }
    if ((packageJson.description?.length ?? 0) < 5) {
      throw new Error(`package.json should have a description`);
    }
    if (!packageJson.engines?.node) {
      throw new Error(`package.json should specify the node version it is compatible with`);
    }
    if (packageJson.homepage === undefined) {
      throw new Error(`package.json should have a homepage (probably the git repo)`);
    }
    await new Promise((resolve, reject) => {
      exec("npm audit", (err, stdout) => {
        if (err) reject(new Error(stdout.trim()));
        else resolve(stdout.trim());
      });
    });
    await lint();

    // calculating next version using semantic release principles
    const releaseData = await generateRelease(cfg.prevHash);
    const nextSemver = versionToSemverString(releaseData.next);

    // suggest untestable final sanity checklist
    cfg.log(
      `${versionToHumanString(releaseData.prev)} => ${versionToHumanString(
        releaseData.next
      )}\n\nFinal checklist:\n${[
        "do you need to update the readme?",
        "would anything be better as a peer dependency?",
        "are the examples in the readme examples for cli/api also tests?",
      ]
        .map((question) => `  - ${question}`)
        .join("\n")}\n`
    );
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 3500);
    });
    let canProgress = false;
    while (!canProgress) {
      const answer = (await ask(`release? [N/y]`)).trim().toLowerCase();
      if (answer === "y") {
        canProgress = true;
      } else if (answer === "n") {
        return false;
      }
    }

    // final checks
    write("package.json", JSON.stringify({ ...pkgJson(), version: nextSemver }, null, 2));

    remove("node_modules");
    run("npm install --engine-strict --ignore-scripts", { stdio: "inherit" });
    await build(nextSemver);
    await test();
    await checkBuild(nextSemver);

    cfg.log("final release checks passed... releasing...");

    // prevent user kill during release
    const disableProcessExit = () => {
      /* noop */
    };
    process.on("SIGINT", disableProcessExit); // CTRL+C
    process.on("SIGQUIT", disableProcessExit); // Keyboard quit
    process.on("SIGTERM", disableProcessExit); // `kill` command

    // the release
    const { name, license, main, module, types, author, homepage } = pkgJson();
    for (const distFile of [main, module, types]) {
      if (distFile) {
        const distFileContents = read(distFile);
        let eol1Index = distFileContents.indexOf("\n");
        if (eol1Index === -1) eol1Index = Number.POSITIVE_INFINITY;
        const line1 = distFileContents.slice(0, eol1Index);

        let authorStr = "";
        if (typeof author === "string") {
          authorStr = author;
        } else if (author) {
          authorStr = `${author.name}${author.email ? ` <${author.email}>` : ""}${
            author.url ? ` (${author.url})` : ""
          }`;
        }

        const licenceStr = license ? `@license ${license} ` : "";

        const comment = `/**! ${[name, authorStr, licenceStr].join(" | ")} */`;

        write(
          distFile,
          line1.startsWith("#!")
            ? line1 + "\n" + comment + "\n" + distFileContents.slice(eol1Index + 1)
            : comment + "\n" + distFileContents
        );
      }
    }

    const runUnlessDry = (command: string, execOpts: Parameters<typeof run>[1]) => {
      if (cfg.dryRun) {
        cfg.log(`dry run (skip): ${command}`);
      } else {
        return run(command, execOpts);
      }
    };

    runUnlessDry("git add .", { stdio: "inherit" });
    runUnlessDry(`git commit -m 'ci: release v${nextSemver}'`, { stdio: "inherit" });
    runUnlessDry(`git tag -a v${nextSemver} -m '${nextSemver}'`, { stdio: "inherit" });
    runUnlessDry(`git push`, { stdio: "inherit" });
    runUnlessDry(`git push origin v${nextSemver}`, { stdio: "inherit" });
    if (!isFile(`${homedir()}/.npmrc`)) {
      runUnlessDry(`npm login`, { stdio: "inherit" });
    }
    runUnlessDry(`npm publish`, { stdio: "inherit" });

    if (homepage && homepage.startsWith("https://github.com/")) {
      cfg.log("Prefilled GitHub release link:");
      cfg.log(
        `${homepage}/releases/new?tag=v${nextSemver}&title=v${nextSemver}&body=${encodeURIComponent(
          generateChangelogMarkdown(releaseData)
        )}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      // cfg.log("error: " + error.message);
      cfg.log(error.stack ?? "");
    }
    return false;
  }

  return true;
};

// internal helper to aid conversion of string to auto npm run script logic
const runify = (
  scriptName: string,
  errorOnMissing = false,
  runOpts?: Parameters<typeof run>[1]
): (() => Promise<void>) => {
  return async () => {
    const scripts = pkgJson()?.scripts ?? {};
    if (scripts[scriptName]) {
      run(`npm run ${scriptName}`, runOpts);
    } else if (errorOnMissing) {
      throw new Error(`expected package.json to have a script called '${scriptName}'`);
    }
  };
};
