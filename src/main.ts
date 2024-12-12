import * as core from '@actions/core';
import * as http from '@actions/http-client';
import * as glob from '@actions/glob';

export async function run() {
    const root = core.getInput("root");
    if (!root.startsWith("http://") && !root.startsWith("https://")) {
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
    const statusRes = await client.get(`${root}/api/overview?apikey=${key}`, headers);
    const status = await statusRes.readBody();
    if(JSON.parse(status).status != "200") {
        core.setFailed("Failed to connect to the server");
        return;
    }
    core.info('Connection successful');
    const globber = await glob.create(core.getInput("source"));
    const files = await globber.glob();
    core.debug(files.join("\n"));
}