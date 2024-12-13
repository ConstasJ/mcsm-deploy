import * as core from '@actions/core'
import * as http from '@actions/http-client'
import * as glob from '@actions/glob'
import path from 'path'
import fs from 'fs'
import axios, { AxiosError } from 'axios'
import { fileFromPath } from 'formdata-node/file-from-path'
import { FormData } from 'formdata-node'

export async function run() {
  const root = core.getInput('root')
  if (!root.startsWith('http://') && !root.startsWith('https://')) {
    core.setFailed('root must be a valid URL')
    return
  }
  const client = new http.HttpClient('http-client')
  core.info('Testing connection to ' + root)
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Requested-With': 'XMLHttpRequest'
  }
  const key = core.getInput('api-key')
  const statusRes = await client.get(
    `${root}/api/overview?apikey=${key}`,
    headers
  )
  const status = await statusRes.readBody()
  if (JSON.parse(status).status != '200') {
    core.setFailed('Failed to connect to the server')
    return
  }
  core.info('Connection successful')
  const globber = await glob.create(core.getInput('source'))
  const files = await globber.glob()
  if (files.length <= 0) {
    core.setFailed('No file matches the source pattern');
    return;
  }
  const daemonId = core.getInput('daemon-id')
  const appId = core.getInput('server-id')
  const targetPath = core.getInput('target-path')
  core.debug(files.join('\n'))
  await Promise.all(
    files.map(async file => {
      core.info(`find file ${path.relative(process.cwd(), file)}`)
    core.info(`Uploading file to configured MCSManager application instance...`)
    const fileName = path.basename(file)
    core.info(`Getting upload URL for file ${fileName}...`)
    const uploadArgObj = JSON.parse(
      await (
        await client.post(
          `${root}/api/files/upload?apikey=${key}&daemonId=${daemonId}&uuid=${appId}&upload_dir=${targetPath}&file_name=${fileName}`,
          ''
        )
      ).readBody()
    )
    if (uploadArgObj.status != 200) {
      core.setFailed(`Failed to get upload URL for file ${fileName}`)
      return
    }
    core.info(`Uploading file ${fileName} to ${uploadArgObj.data.addr}...`)
    const form = new FormData()
    form.append('file', await fileFromPath(file))
    const addr = (() => {
      if (uploadArgObj.data.addr.startsWith('wss://')) {
        return uploadArgObj.data.addr.replace('wss://', '')
      } else {
        return uploadArgObj.data.addr
      }
    })()
    const uploadRes = await axios.postForm(
      `https://${addr}/upload/${uploadArgObj.data.password}?overwrite=true`,
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Content-Length': fs.readFileSync(file).length
        }
      }
    )
    if (uploadRes.status != 200) {
      core.setFailed(`Failed to upload file ${fileName}`)
      return
    }
    core.info(`File ${fileName} uploaded successfully`)
    })
  )
  core.info(`Restart application instance...`)
  let restartRes;
  try {
    restartRes = await axios.get(
      `${root}/api/protected_instance/restart?apikey=${key}&daemonId=${daemonId}&uuid=${appId}`,
      {
        headers,
      }
    )
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (e.response) {
        core.debug(JSON.stringify(e.response.data));
        core.debug(e.response.status.toString());
        core.debug(JSON.stringify(e.response.headers));
      } else if (e.request) {
        core.debug(JSON.stringify(e.request));
      } else {
        core.debug(e.message);
      }
      core.debug(JSON.stringify(e.config) || "");
    }
    core.setFailed("Failed to restart application instance");
    return;
  }
  if (restartRes.status != 200) {
    core.setFailed(`Failed to restart application instance`)
    return
  }
  core.info(`Application instance restarted successfully`)
}
