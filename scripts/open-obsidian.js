const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const vaultPath = path.join(root, "content");

console.log(`Opening Obsidian vault: ${vaultPath}`);

if (process.platform === "darwin") {
  const result = spawnSync("open", ["-a", "Obsidian", vaultPath], { stdio: "inherit" });
  if (result.status === 0) process.exit(0);
}

console.log("If Obsidian did not open automatically, open this folder as a vault:");
console.log(vaultPath);
