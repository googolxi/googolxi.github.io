const { spawnSync } = require("child_process");

const message = process.argv.slice(2).join(" ").trim() || "Update blog";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

run("npm", ["run", "build"]);
run("git", ["add", "-A"]);

const diff = spawnSync("git", ["diff", "--cached", "--quiet"], { stdio: "inherit" });
if (diff.status === 0) {
  console.log("No changes to publish.");
  process.exit(0);
}

run("git", ["commit", "-m", message]);
run("git", ["push", "origin", "main"]);
