# Electron IPC Wrapper

It is a rxjs based electron ipc wrapper

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
It is for `v1`

- __BehaviorSubject__ are used to wrap araound the electron's ipc events.
- Each instance mantain a list of both incoming and outgoing data subjects.
- Each new channel generates a new subject on both processes and can be subscribed to from both processes.
- To create a new channel, `ipc.addChanel('testing', 'anything');`
    - Now this subject can be subscribed from the other end of the ipc by one of the following(all of them will return the same subject if exists),
        - `ipc.get<string>('testing')`.
        - `ipc.channels?.incoming?.testing`
    - You can also access it over the same process by using the following,
        - `ipc.getLocal<string>('testing')`.
        - `ipc.channels?.outgoing?.testing`
    - if you set value for outgoing ones `testing.set('new')`, there state will be updated accross the processes

 ### V2
 its under design, will have single class/object to both end of channels
## Notes

- it is in very early stages.
- I am going to maintain it in two branches(`v1` and `v2`), with different design approaches.
