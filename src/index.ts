import * as core from '@actions/core';

async function main() {
    const root = core.getInput("root");
    if (!root.startsWith("http://") || !root.startsWith("https://")) {
        core.setFailed("root must be a valid URL");
        return;
    }
    const url = new URL(root);
}

main();