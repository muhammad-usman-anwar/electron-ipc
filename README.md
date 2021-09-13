# Electron IPC Wrapper V2

It is a rxjs based electron ipc wrapper __V2__, check out [Quick Start](#quick-start)

## Notes

- it is in very early stages(Please do suggest improvements over github).
- I am going to maintain it in two branches(`v1` and `v2`), with different design approaches.
- I have added a quick start guid at the end basing on electron one.

## Installation

```bash
npm i electron-reactive-ipc #for npm
yarn add electron-reactive-ipc #for yarn
```

## Usage

### Setup
It has to be initialized in both processes(`main` and `renderer`),

#### main
The window object is required for it to initialize
```ts
import { ElectronIPC } from 'electron-reactive-ipc'

/*
  rest of the code
*/

function createWindow () {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile('index.html')
    const ipc = ElectronIPC.initialize(win);
}

```

### renderer
this has to be called from __preload__ script(unless node integration is enabled).
```ts
import { ElectronIPC } from 'electron-reactive-ipc'

/*
  rest of the code
*/

const ipc = ElectronIPC.initialize();
```

### Sample Code
Its part of the main repository, check out `https://github.com/muhammad-usman-anwar/electron-ipc/tree/main/electron`

## Documentation
It is for `v2`
**Added multi window support, uses `webContents.id` to reference/index channels**

- __BehaviorSubject__ are used to wrap araound the electron's ipc events.
- Each instance mantain a list of both incoming and outgoing data subjects.
- Each new channel generates a new subject on both processes and can be subscribed to from both processes.
- To create a new channel, `ipc.addChanel('testing', 'anything');`
    - Now this subject can be subscribed from the other end of the ipc by one of the following(all of them will return the same subject if exists),
        - `ipc.get<string>('testing')`.
        - `ipc.channels?.testing`
    - if you set value for outgoing ones `testing.set('new')`, there state will be updated accross the processes
- Following methods are available to send and recieve data,
    - `send(data:any)`
    - `listen`, observable for incoming data

### class: `ElectronIPC`

#### static method: `initialize(win?: BrowserWindow)`
Initializes/provides with instance of the class, `win` param is required for __main__ process. If instance already exists, it will set the `win` as the default window.

#### static member: `initialize`
Refers to the instance of the class.

#### method: `addChanel<T>(name: string, data: T, win?: BrowserWindow)`
Adds a full duplex chanel for communication, `win` param is only valid for __main__ process. It used to associate the channel with the given window(if omitted, will use the default window)

#### method: `getChannelsForWindow(id?: number)`
Gets all the available channels for the provided `WebContents.id`

#### method: `get<T>(channelName: string, id?:number)`
gets an available chanel by its name/title, null if not present. `id` param is only valid for __main__ process. It refers to `BrowserWindow.webContents.id`, to fetch the respective window's channel(if omitted then default `win`'s id is used)

#### member: `deaultWindow` `//setter only`
used to set default browserWIndow later on.

#### member: `channels`
Object contatining all the available channels (for __main__, returns default `win`'s channels)
```ts
{
  [index:string]:DuplexChannel;
}
```
Above __index__ is the `chanelName`

### class: `DuplexChannel<U>`
__U__ is the type of data for transmission

#### member: `listen`
Objservable, outputs incoming data on the channel.

#### method: `send(data: U)`
send data to other end of IPC channel

#### method: `close()`
closes the ipc channel observers

## Quick Start

This quick start guid is the same as the one provided by electron team, with few additions.

### `main.ts`

```ts
// Modules to control application life and create native browser window
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { ElectronIPC } from 'electron-reactive-ipc'

function createWindow () {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
        preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    //FOLLOWING IS THE CODE FOR INTEGRATION
    // ELectronIPC is a singleton class for now
    const ipc = ElectronIPC.initialize(mainWindow)
    const channel = ipc.addChanel('testing', { message: 'done' });
    channel.listen?.subscribe(val => {
        console.log(val);
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

```

### `preload.ts`

```ts
import { ElectronIPC } from 'electron-reactive-ipc'

const ipc = ElectronIPC.initialize();
(window as any).ipc = ipc;
setTimeout(() => {
    const channel = ipc.get<{ message: string }>('testing');
    channel?.listen.subscribe(val => {
        console.log(val);
    });
}, 5000);


window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

```

### `index.html`

```html
<!--index.html-->

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <meta http-equiv="X-Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <title>Hello World!</title>
  </head>
  <body>
    <h1>Hello World!</h1>
    We are using Node.js <span id="node-version"></span>,
    Chromium <span id="chrome-version"></span>,
    and Electron <span id="electron-version"></span>.

    <!-- You can also require other files to run in this process -->
    <script src="./renderer.js"></script>
  </body>
</html>

```
