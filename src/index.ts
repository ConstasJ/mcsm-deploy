import * as core from '@actions/core';
import * as http from '@actions/http-client';

async function main() {
    const root = core.getInput("root");
    if (!root.startsWith("http://") || !root.startsWith("https://")) {
        core.setFailed("root must be a valid URL");
        return;
    }
    const client = new http.HttpClient("http-client")
    core.info('Testing connection to ' + root);
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Requested-With": "XMLHttpRequest"
    }
    const key = core.getInput("api-key");
    const statusRes = await client.get(`${root}/api/overview?apiKey=${key}`, headers);
    if(JSON.parse(await statusRes.readBody()).status != "200") {
        core.setFailed("Failed to connect to the server");
        return;
    }
}

main();